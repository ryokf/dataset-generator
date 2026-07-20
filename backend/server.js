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
            data_penjual: [], 
            data_pihak_persetujuan: [], 
            data_pembeli: [], 
            sertifikat: { nib: "", nomor_hak_atau_kode_sertif: "" },
            pbb: { nop: "", tahun: "", luas: "", njop: "" },
            bphtb: { no_bukti_pembayaran: "" }, pph: { npwp: "", no_suket: "" },
            nilai_akta: "", data_saksi: []
        }
    };
}

app.post('/api/intercept', (req, res) => {
    const { form_id, timestamp, data } = req.body;
    const current_akta_id = data.aktaid;

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
    // LOGIKA PEMETAAN (MAPPING) DENGAN ARRAY MERGE
    // ==========================================
    if (form_id === 'frmEditAkta') {
        entry.output.no_akta = data.nomor || ""; 
        entry.output.tanggal_akta = data.tanggal || ""; 
    } 
    
    // 1. PENJUAL: MENCAKUP PERORANGAN DAN BADAN HUKUM
    else if (form_id === 'frmtipepihak1Dukcapil' || form_id === 'frmInput1BadanHukum' || data.jenis === 'Pihak 1') {
        let arrPenjual = entry.output.data_penjual || [];
        let personIndex = -1;

        if (data.dokumenid && data.dokumenid.trim() !== "") {
            personIndex = arrPenjual.findIndex(p => p._dokumen_id === data.dokumenid);
        }

        let personData = { _dokumen_id: data.dokumenid || "" };

        // Deteksi Badan Hukum dari ID Form atau Tipe Pemohon
        if (form_id === 'frmInput1BadanHukum' || data.tipepemohon === '3') {
            personData = {
                ...personData,
                tipe_penjual: "badan hukum",
                jenis: data.tipepemilikid || "", 
                tipe: data.tipeusaha || "", 
                nama: data.NAMA_LENGKAP || "",
                alamat: data.ALAMAT || "", 
                kota: data.NAMA_KABUPATEN || "", 
                npwp: data.npwp || "",
                no_akta_pendirian: data.nomoridentitas || "", // Menggunakan atribut asli dari ATRBPN
                tgl_akta_pendirian: data.TANGGAL_PENDIRIAN || "" // Menggunakan atribut asli dari ATRBPN
            };
        } else {
            personData = {
                ...personData,
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

        if (personIndex !== -1) arrPenjual[personIndex] = { ...arrPenjual[personIndex], ...personData };
        else arrPenjual.push(personData);
        
        entry.output.data_penjual = arrPenjual;
    }
    
    // 2. PIHAK PERSETUJUAN
    else if (form_id === 'frmPihaksetujuDukcapil' || data.jenis === 'WNI' || data.jenis === 'WNA') {
        let arrPersetujuan = entry.output.data_pihak_persetujuan || [];
        let personIndex = -1;

        if (data.dokumenid && data.dokumenid.trim() !== "") {
            personIndex = arrPersetujuan.findIndex(p => p._dokumen_id === data.dokumenid);
        }

        const personData = {
            _dokumen_id: data.dokumenid || "", 
            nik: data.NIK || "",
            nama: data.NAMA_LENGKAP || "",
            alamat: data.ALAMAT || "",
            tempat_lahir: data.TEMPAT_LAHIR || "",
            tgl_lahir: data.TANGGAL_LAHIR || "",
            jenis_kelamin: data.JENIS_KELAMIN || "",
            pekerjaan: data.JENIS_PEKERJAAN || ""
        };

        if (personIndex !== -1) arrPersetujuan[personIndex] = { ...arrPersetujuan[personIndex], ...personData };
        else arrPersetujuan.push(personData);
        
        entry.output.data_pihak_persetujuan = arrPersetujuan;
    }
    
    // 3. PEMBELI: MENCAKUP PERORANGAN DAN BADAN HUKUM
    else if (form_id === 'frmtipepihak2Dukcapil' || form_id === 'frmInput2BadanHukum' || data.jenis === 'Pihak 2') {
        let arrPembeli = entry.output.data_pembeli || [];
        let personIndex = -1;

        if (data.dokumenid && data.dokumenid.trim() !== "") {
            personIndex = arrPembeli.findIndex(p => p._dokumen_id === data.dokumenid);
        }

        let personData = { _dokumen_id: data.dokumenid || "" };

        if (form_id === 'frmInput2BadanHukum' || data.tipepemohon === '3') {
            personData = {
                ...personData,
                tipe_pembeli: "badan hukum",
                jenis: data.tipepemilikid || "", 
                tipe: data.tipeusaha || "", 
                nama: data.NAMA_LENGKAP || "", 
                alamat: data.ALAMAT || "", 
                kota: data.NAMA_KABUPATEN || "", 
                npwp: data.npwp || "",
                no_akta_pendirian: data.nomoridentitas || "", 
                tgl_akta_pendirian: data.TANGGAL_PENDIRIAN || ""
            };
        } else {
            personData = {
                ...personData,
                tipe_pembeli: "perorangan",
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

        if (personIndex !== -1) arrPembeli[personIndex] = { ...arrPembeli[personIndex], ...personData };
        else arrPembeli.push(personData);
        
        entry.output.data_pembeli = arrPembeli;
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

    // SIMPAN KEMBALI KE FILE JSON
    fs.writeFile(datasetFile, JSON.stringify(currentData, null, 4), (err) => {
        if (err) return res.status(500).json({ status: 'error' });
        console.log(`[Disimpan - Berhasil] ID Dokumen: ${current_akta_id} | Dari: ${form_id}`);
        res.status(200).json({ status: 'success' });
    });
});

app.listen(3000, () => {
    console.log('Collector Server berjalan. Menunggu data...');
});