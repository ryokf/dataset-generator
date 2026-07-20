const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Sekarang kita simpan sebagai .json biasa (bukan .jsonl)
const datasetFile = path.join(__dirname, 'dataset_atrbpn.json');

function createBaseSchema() {
    return {
        session_id: "", // Tetap dipertahankan untuk kebutuhan merge via Python/Pandas nanti
        form_source: "",
        input_ocr: {
            ajb: "", npwp_penjual: "", akta_pendirian_penjual: "", ktp_persetujuan: [],
            ktp_pembeli: "", kk_pembeli: "", kode_berkas_cek: "", sertifikat: "",
            pbb: "", bphtb: "", pph: "", ktp_saksi: []
        },
        output: { // Diubah dari ground_truth menjadi output
            no_akta: "", tanggal_akta: "",
            data_penjual: {}, data_pihak_persetujuan: [], data_pembeli: {},
            sertifikat: { nib: "", nomor_hak_atau_kode_sertif: "" },
            pbb: { nop: "", tahun: "", luas: "", njop: "" },
            bphtb: { no_bukti_pembayaran: "" }, pph: { npwp: "", no_suket: "" },
            nilai_akta: "", data_saksi: []
        }
    };
}

app.post('/api/intercept', (req, res) => {
    const { session_id, form_id, timestamp, data } = req.body;
    
    // LOG RAW DATA UNTUK DEBUGGING NAMA ATRIBUT
    console.log(`\n=== RAW DATA DARI FORM ${form_id} ===`);
    console.log(data);
    console.log("======================================");

    let entry = createBaseSchema();
    entry.session_id = session_id;
    entry.form_source = form_id;

    // MAPPING DATA
    if (form_id === 'frmEditAkta') {
        entry.output.no_akta = data.nomor_akta || ""; 
        entry.output.tanggal_akta = data.tanggal_akta || ""; 
    } 
    else if (form_id === 'frmtipepihak1Dukcapil') {
        const tipe = (data.tipe_entitas === '1') ? 'perorangan' : 'badan hukum';
        
        if (tipe === 'badan hukum') {
            entry.output.data_penjual = {
                tipe_penjual: "badan hukum",
                jenis: data.jenis || "", tipe: data.tipe || "", nama: data.nama || "",
                alamat: data.alamat || "", kota: data.kota || "", npwp: data.npwp || "",
                no_akta_pendirian: data.no_akta_pendirian || "", tgl_akta_pendirian: data.tgl_akta_pendirian || ""
            };
        } else {
            entry.output.data_penjual = {
                tipe_penjual: "perorangan",
                jenis_bukti_identitas: data.jenis_bukti_identitas || "", nomor_identitas: data.nomor_identitas || "",
                nama: data.nama || "", alamat: data.alamat || "", tempat_lahir: data.tempat_lahir || "",
                tgl_lahir: data.tgl_lahir || "", jenis_kelamin: data.jenis_kelamin || "", pekerjaan: data.pekerjaan || ""
            };
        }
    }

    // LOGIKA PENYIMPANAN ARRAY JSON
    let currentData = [];
    
    // Jika file sudah ada, baca dan ubah string JSON menjadi Array JS
    if (fs.existsSync(datasetFile)) {
        try {
            const fileContent = fs.readFileSync(datasetFile, 'utf8');
            if (fileContent.trim() !== '') {
                currentData = JSON.parse(fileContent);
            }
        } catch (err) {
            console.error("Gagal membaca file JSON sebelumnya:", err);
        }
    }

    // Masukkan data baru ke dalam Array
    currentData.push(entry);

    // Tulis kembali seluruh Array ke dalam file JSON dengan format yang rapi (indentasi 4 spasi)
    fs.writeFile(datasetFile, JSON.stringify(currentData, null, 4), (err) => {
        if (err) {
            console.error("Gagal menulis ke file:", err);
            return res.status(500).json({ status: 'error', message: err.message });
        }
        console.log(`[Terekam - Array Diperbarui] Form: ${form_id}`);
        res.status(200).json({ status: 'success' });
    });
});

app.listen(3000, () => {
    console.log('Collector Server berjalan. Menunggu data di port 3000...');
});