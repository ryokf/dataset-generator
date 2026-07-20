const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const datasetFile = path.join(__dirname, 'dataset_atrbpn.json');

function createBaseSchema() {
    return {
        session_id: "",
        form_source: "",
        input_ocr: {
            ajb: "", npwp_penjual: "", akta_pendirian_penjual: "", ktp_persetujuan: [],
            ktp_pembeli: "", kk_pembeli: "", kode_berkas_cek: "", sertifikat: "",
            pbb: "", bphtb: "", pph: "", ktp_saksi: []
        },
        output: {
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
    
    console.log(`\n=== RAW DATA DARI FORM ${form_id} ===`);
    console.log(data);
    console.log("======================================");

    // 1. BACA FILE JSON YANG SUDAH ADA
    let currentData = [];
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

    // 2. SMART MERGE: Cari apakah session_id ini sudah ada di database
    let entryIndex = currentData.findIndex(item => item.session_id === session_id);
    let entry;

    if (entryIndex !== -1) {
        // Jika sudah ada, gunakan objek yang lama untuk diperbarui
        entry = currentData[entryIndex];
        entry.form_source = form_id; 
    } else {
        // Jika belum ada (sesi baru), buat kerangka baru
        entry = createBaseSchema();
        entry.session_id = session_id;
        entry.form_source = form_id;
        currentData.push(entry); // Masukkan ke dalam array
    }

    // 3. LOGIKA PEMETAAN (Hanya memperbarui bagian form yang sedang diketik)
    if (form_id === 'frmEditAkta') {
        entry.output.no_akta = data.nomor || ""; 
        entry.output.tanggal_akta = data.tanggal || ""; 
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
                jenis_bukti_identitas: data.tipebuktiid || "", 
                nomor_identitas: data.NIK || "",
                nama: data.NAMA_LENGKAP || "", 
                alamat: data.ALAMAT || "", 
                tempat_lahir: data.TEMPAT_LAHIR || "",
                tgl_lahir: data.TANGGAL_LAHIR || "", 
                jenis_kelamin: data.JENIS_KELAMIN || "", 
                pekerjaan: data.JENIS_PEKERJAAN || ""
            };
        }
    }
    else if (form_id === 'frmPihaksetujuDukcapil') {
        entry.output.data_pihak_persetujuan = [{
            nik: data.NIK || "",
            nama: data.NAMA_LENGKAP || "",
            alamat: data.ALAMAT || "",
            tempat_lahir: data.TEMPAT_LAHIR || "",
            tgl_lahir: data.TANGGAL_LAHIR || "",
            jenis_kelamin: data.JENIS_KELAMIN || "",
            pekerjaan: data.JENIS_PEKERJAAN || ""
        }];
    }
    else if (form_id === 'frmtipepihak2Dukcapil') {
        entry.output.data_pembeli = {
            nomor_identitas: data.NIK || "",
            nama: data.NAMA_LENGKAP || "", 
            alamat: data.ALAMAT || "", 
            tempat_lahir: data.TEMPAT_LAHIR || "",
            tgl_lahir: data.TANGGAL_LAHIR || "", 
            jenis_kelamin: data.JENIS_KELAMIN || "", 
            pekerjaan: data.JENIS_PEKERJAAN || ""
        };
    }
    else if (form_id === 'frmHAT') {
        entry.output.sertifikat = {
            nib: data.nib || "",
            nomor_hak_atau_kode_sertif: data.nomorhak || ""
        };
    }
    else if (form_id === 'frmPBBDetail') {
        entry.output.pbb = {
            nop: data.nomor || "",
            tahun: data.tahun || "",
            luas: data.luas || "",
            njop: data.nilai || ""
        };
    }
    else if (form_id === 'frmBPHTB') {
        entry.output.bphtb = {
            no_bukti_pembayaran: data.nomorbphtb || ""
        };
    }
    else if (form_id === 'frmSurat') {
        entry.output.pph = {
            npwp: data.npwp || "",
            no_suket: data.kodeverifikasi || ""
        };
    }

    // 4. SIMPAN KEMBALI KE FILE JSON
    fs.writeFile(datasetFile, JSON.stringify(currentData, null, 4), (err) => {
        if (err) {
            console.error("Gagal menulis ke file:", err);
            return res.status(500).json({ status: 'error', message: err.message });
        }
        console.log(`[Berhasil Diperbarui] Form: ${form_id}`);
        res.status(200).json({ status: 'success' });
    });
});

app.listen(3000, () => {
    console.log('Collector Server berjalan. Menunggu data di port 3000...');
});