console.log("Harvester ATRBPN aktif di halaman ini...");

// Membuat ID Sesi unik saat halaman pertama kali dimuat.
// Semua form yang diisi dalam satu halaman ini akan memiliki session_id yang sama.
const session_id = "ajb_session_" + Date.now().toString();

// Mendengarkan setiap ada perubahan nilai input di seluruh halaman
document.addEventListener('change', (event) => {
    // Daftar ID form krusial yang sudah kita petakan sebelumnya
    const targetForms = [
        '#frmEditAkta', 
        '#frmtipepihak1Dukcapil', 
        '#frmtipepihak2Dukcapil',
        '#frmPihaksetujuDukcapil',
        '#frmBAProtokol'
    ];

    // Cek apakah input yang baru saja diubah berada di dalam salah satu form target kita
    const formElement = event.target.closest(targetForms.join(', '));
    
    if (formElement) {
        // Ambil seluruh data dari form tersebut
        const formData = new FormData(formElement);
        const dataPayload = Object.fromEntries(formData.entries());
        
        // Siapkan struktur paket data
        const payload = {
            session_id: session_id,
            form_id: formElement.id,
            timestamp: new Date().toISOString(),
            data: dataPayload
        };
        
        console.log(`[Intercept] Menangkap data dari ${formElement.id}`);
        
        // Kirim langsung ke server lokal
        kirimKeLocalServer(payload);
    }
});

// Fungsi untuk mengirim paket data ke server Node.js kamu
function kirimKeLocalServer(payload) {
    fetch('http://localhost:3000/api/intercept', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
    })
    .then(response => {
        if (!response.ok) throw new Error("Server lokal menolak request");
    })
    .catch(err => {
        console.error("Gagal mengirim data ke server. Pastikan server Node.js berjalan.", err);
    });
}