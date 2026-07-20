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
        akta_id: "", 
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
    const { form_id, timestamp, data } = req.body;
    
    // MENGAMBIL ID AKTA LANGSUNG DARI PAYLOAD FORM ATRBPN
    const current_akta_id = data.aktaid;

    // Abaikan request jika form tidak mengandung aktaid (mencegah error)
    if (!current_akta_id) {
        return res.status(400).json({ error: "Form tidak memiliki aktaid" });
    }

    console.log(`\n=== RAW DATA DARI FORM ${form_id} (Akta ID: ${current_akta_id}) ===`);
    
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

    // SMART MERGE BERDASARKAN akta_id
    let entryIndex = currentData.findIndex(item => item.akta_id === current_akta_id);
    let entry;

    if (entryIndex !== -1) {
        entry = currentData[entryIndex];
        entry.form_source = form_id; 
    } else {
        entry = createBaseSchema();
        entry.akta_id = current_akta_id;
        entry.form_source = form_id;
        currentData.push(entry);
    }

    // ==========================================
    // LOGIKA PEMETAAN 
    // ==========================================
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
            }; // FIX: tidak ada wrapping ganda
        }
    }
    else if (form_id === 'frmPihaksetujuDukcapil') {
        const pihakBaru = {
            nik: data.NIK || "",
            nama: data.NAMA_LENGKAP || "",
            alamat: data.ALAMAT || "",
            tempat_lahir: data.TEMPAT_LAHIR || "",
            tgl_lahir: data.TANGGAL_LAHIR || "",
            jenis_kelamin: data.JENIS_KELAMIN || "",
            pekerjaan: data.JENIS_PEKERJAAN || ""
        };
        // FIX: Cari berdasarkan NIK agar tidak duplikat; jika baru, push ke array
        if (!Array.isArray(entry.output.data_pihak_persetujuan)) {
            entry.output.data_pihak_persetujuan = [];
        }
        const idxPihak = entry.output.data_pihak_persetujuan.findIndex(p => p.nik && p.nik === pihakBaru.nik);
        if (idxPihak !== -1) {
            entry.output.data_pihak_persetujuan[idxPihak] = pihakBaru; // Update jika NIK sama
        } else {
            entry.output.data_pihak_persetujuan.push(pihakBaru); // Tambah ke array jika NIK baru
        }
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

    fs.writeFile(datasetFile, JSON.stringify(currentData, null, 4), (err) => {
        if (err) return res.status(500).json({ status: 'error' });
        console.log(`[Disimpan] ID Dokumen: ${current_akta_id}`);
        res.status(200).json({ status: 'success' });
    });
});

app.listen(3000, () => {
    console.log('Collector Server berjalan dengan Smart Merge (Akta ID). Menunggu data...');
});