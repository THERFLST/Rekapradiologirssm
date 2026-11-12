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

      const prompt = `Baca formulir/kertas pendaftaran pasien radiologi berbahasa Indonesia, termasuk TULISAN TANGAN.
Ekstrak hanya informasi yang benar-benar terlihat dan terkait label:
- nama: nama pasien pada label Nama (jangan masukkan nomor rekam medis)
- wa: nomor WhatsApp/HP/telepon pasien
- jenis: jenis pemeriksaan USG
- dokter: nama dokter pemeriksa/radiologi (bukan dokter pengirim)
- tanggal: tanggal pemeriksaan dalam format YYYY-MM-DD bila jelas; jika tidak jelas kosong.
Jangan menebak, jangan memperbaiki ejaan nama, jangan mengarang digit nomor telepon. Jika ambigu atau tidak yakin, isi string kosong. Jangan mengambil nomor registrasi/rekam medis sebagai nomor WA. Untuk tiap field berikan confidence angka 0 sampai 1 yang mencerminkan keterbacaan tulisan, bukan tebakan. Keluaran JSON saja dengan bentuk:
{"nama":"","wa":"","jenis":"","dokter":"","tanggal":"","confidence":{"nama":0,"wa":0,"jenis":0,"dokter":0,"tanggal":0}}
Pastikan semua nilai field berupa string.`;
      const ai = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: env.OPENAI_MODEL || "gpt-4.1-mini",
          temperature: 0,
          max_tokens: 500,
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
      for (const field of fields) if (typeof data[field] !== "string") data[field] = "";
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
