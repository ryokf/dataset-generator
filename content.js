console.log("Harvester ATRBPN aktif di halaman ini...");

document.addEventListener('change', (event) => {
    // Menangkap seluruh form krusial di ATRBPN
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

    const formElement = event.target.closest(targetForms.join(', '));
    
    if (formElement) {
        // Menyalin semua input, termasuk <input type="hidden" name="aktaid"> bawaan web
        const formData = new FormData(formElement);
        const dataPayload = Object.fromEntries(formData.entries());
        
        const payload = {
            form_id: formElement.id,
            timestamp: new Date().toISOString(),
            data: dataPayload
        };
        
        kirimKeLocalServer(payload);
    }
});

function kirimKeLocalServer(payload) {
    fetch('http://localhost:3000/api/intercept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).catch(err => console.error("Gagal mengirim data:", err));
}