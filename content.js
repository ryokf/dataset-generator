console.log("Harvester ATRBPN aktif dengan mode Intercept Submit...");

// Menggunakan event 'submit' dengan mode CAPTURING (parameter 'true' di bagian bawah).
// Ini memastikan ekstensi menangkap data SEBELUM web ATRBPN memblokir datanya.
document.addEventListener('submit', (event) => {
    // Daftar ID form krusial di ATRBPN
    const targetForms = [
        '#frmEditAkta', 
        '#frmtipepihak1Dukcapil', 
        '#frmtipepihak2Dukcapil',
        '#frmPihaksetujuDukcapil', 
        '#frmHAT', 
        '#frmPBBDetail', 
        '#frmBPHTB', 
        '#frmSurat'
    ];

    // Pada event 'submit', event.target adalah elemen <form> itu sendiri
    const formElement = event.target;
    
    // Pastikan form yang disubmit adalah salah satu dari target kita
    if (formElement && formElement.matches && formElement.matches(targetForms.join(', '))) {
        // Ekstrak seluruh isian form saat tombol submit/simpan ditekan
        const formData = new FormData(formElement);
        const dataPayload = Object.fromEntries(formData.entries());
        
        const payload = {
            form_id: formElement.id,
            timestamp: new Date().toISOString(),
            data: dataPayload
        };
        
        console.log(`[Intercept] Tombol Submit ditekan pada: ${formElement.id}`);
        
        // Kirim hasil final form tersebut ke server lokal
        kirimKeLocalServer(payload);
    }
}, true); // <-- 'true' ini adalah kunci utamanya (Capturing Phase)

function kirimKeLocalServer(payload) {
    fetch('http://localhost:3000/api/intercept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
    }).catch(err => console.error("Gagal mengirim data ke server lokal:", err));
}