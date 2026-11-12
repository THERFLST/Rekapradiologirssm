/**
 * Cloudflare Worker - AI Vision OCR untuk Reminder USG.
 * Simpan OPENAI_API_KEY sebagai Worker Secret, bukan di repository.
 * Set ALLOWED_ORIGIN ke origin GitHub Pages aplikasi.
 */
const corsHeaders = (origin, env) => ({
  "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || origin || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Vary": "Origin"
});

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const json = (data, status = 200) => new Response(JSON.stringify(data), {
      status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
    });
    if (request.method !== "POST") return json({ error: "Metode tidak diizinkan." }, 405);
    if (env.ALLOWED_ORIGIN && origin && origin !== env.ALLOWED_ORIGIN) return json({ error: "Origin tidak diizinkan." }, 403);
    if (!env.OPENAI_API_KEY) return json({ error: "Secret OPENAI_API_KEY belum dikonfigurasi pada Worker." }, 503);

    try {
      const raw = await request.text();
      if (raw.length > 8_000_000) return json({ error: "Foto terlalu besar. Maksimal payload 8 MB." }, 413);
      const input = JSON.parse(raw);
      const image = typeof input.image === "string" ? input.image : "";
      const mime = input.mimeType === "image/png" ? "image/png" : "image/jpeg";
      if (!image.startsWith(`data:${mime};base64,`)) return json({ error: "Format foto tidak valid." }, 400);

      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
      const prompt = `Ini kertas kecil pendaftaran USG Radiologi RS Setia Mitra (label cetak + tulisan tangan Indonesia).
Label: Tgl daftar, Nama Pasien & No. RM, Tanggal Lahir, No. HP, Hari/Tgl Pemeriksaan, USG & Diagnosa, Dokter Radiologi, Dokter Pengirim. Kadang ada catatan tulisan tangan di pojok (mis. pasien minta ganti jadwal "ke 13/11").
Isi JSON:
- nama: nama pasien saja (tanpa angka dalam kurung = No. RM, tanpa umur/tgl lahir)
- wa: nomor dari label No. HP, hanya digit
- jenis: jenis USG dari baris "USG & Diagnosa" (mis. Abdomen, Mammae, Tiroid, Colli/Leher, Partial/Uro, Jaringan Lunak, Doppler Vaskular, Doppler Testis); abaikan diagnosis (CKD, dsb.)
- dokter: nama dari "Dokter Radiologi" (BUKAN Dokter Pengirim)
- tanggal: tanggal pemeriksaan format YYYY-MM-DD. Bila catatan menyebut jadwal diganti/dipindah/resched/ke tanggal lain, pakai tanggal BARU itu. Bila tahun tidak tertulis, pakai tahun dari hari ini (${today}). Ragu -> ""
- catatan: ringkasan catatan tulisan tangan tambahan (maks 12 kata), atau ""
Jangan menebak digit atau ejaan; ragu -> "". confidence 0-1 untuk nama, wa, jenis, dokter, tanggal.
Keluaran JSON saja: {"nama":"","wa":"","jenis":"","dokter":"","tanggal":"","catatan":"","confidence":{"nama":0,"wa":0,"jenis":0,"dokter":0,"tanggal":0}}`;
      const ai = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: env.OPENAI_MODEL || "gpt-4.1-mini",
          temperature: 0,
          max_tokens: 250,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "Anda adalah pembaca dokumen administrasi radiologi yang teliti. Akurasi lebih penting daripada melengkapi kolom." },
            { role: "user", content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: image, detail: "high" } }
            ]}
          ]
        })
      });
      const result = await ai.json();
      if (!ai.ok) {
        const message = result?.error?.message || "Layanan AI sedang tidak tersedia.";
        return json({ error: message }, ai.status === 429 ? 429 : 502);
      }
      const content = result?.choices?.[0]?.message?.content || "";
      let data;
      try { data = JSON.parse(content); } catch { return json({ error: "AI mengembalikan hasil yang tidak terbaca. Silakan coba lagi." }, 502); }
      const fields = ["nama", "wa", "jenis", "dokter", "tanggal"];
      for (const field of [...fields, "catatan"]) if (typeof data[field] !== "string") data[field] = "";
      if (!data.confidence || typeof data.confidence !== "object") data.confidence = {};
      for (const field of fields) {
        const n = Number(data.confidence[field]);
        data.confidence[field] = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
      }
      return json({ ok: true, data });
    } catch (error) {
      return json({ error: "Permintaan scan gagal diproses. Periksa koneksi dan coba kembali." }, 500);
    }
  }
};
