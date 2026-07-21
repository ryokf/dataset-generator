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
            if (fileContent.trim() !== '') currentData = JSON.parse(fileContent);
        } catch (err) {
            console.error("Gagal membaca JSON:", err);
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
    // LOGIKA PEMETAAN KOKOH 
    // ==========================================
    
    // 1. IDENTITAS AKTA
    if (form_id === 'frmEditAkta' || data.tipe === 'AJB') {
        entry.output.no_akta = data.nomor || ""; 
        entry.output.tanggal_akta = data.tanggal || ""; 
    } 
    
    // 2. PIHAK PENJUAL
    else if (form_id === 'frmtipepihak1Dukcapil' || form_id === 'frmInput1BadanHukum' || data.jenis === 'Pihak 1') {
        let arrPenjual = Array.isArray(entry.output.data_penjual) ? entry.output.data_penjual : [];
        let personIndex = -1;

        const currentNik = (data.NIK || "").trim();
        const currentNoAkta = (data.nomoridentitas || "").trim();
        const currentNama = (data.NAMA_LENGKAP || data.nama || "").trim();

        if (currentNik !== "") {
            personIndex = arrPenjual.findIndex(p => p.nomor_identitas === currentNik);
        } else if (currentNoAkta !== "") {
            personIndex = arrPenjual.findIndex(p => p.no_akta_pendirian === currentNoAkta);
        } else if (currentNama !== "") {
            personIndex = arrPenjual.findIndex(p => p.nama === currentNama);
        }

        const tipe = (data.tipepemohon === '1') ? 'perorangan' : 'badan hukum';
        let personData = {};

        if (tipe === 'badan hukum') {
            personData = {
                tipe_penjual: "badan hukum",
                jenis: data.tipepemilikid || "", tipe: data.tipeusaha || "", nama: currentNama,
                alamat: data.alamat || data.ALAMAT || "", kota: data.kota || data.NAMA_KABUPATEN || "", 
                npwp: data.npwp || "", no_akta_pendirian: currentNoAkta, tgl_akta_pendirian: data.TANGGAL_PENDIRIAN || ""
            };
        } else {
            personData = {
                tipe_penjual: "perorangan",
                jenis_bukti_identitas: data.tipebuktiid || "", nomor_identitas: currentNik,
                nama: currentNama, alamat: data.ALAMAT || "", tempat_lahir: data.TEMPAT_LAHIR || "",
                tgl_lahir: data.TANGGAL_LAHIR || "", jenis_kelamin: data.JENIS_KELAMIN || "", pekerjaan: data.JENIS_PEKERJAAN || ""
            };
        }

        if (personIndex !== -1) arrPenjual[personIndex] = { ...arrPenjual[personIndex], ...personData };
        else arrPenjual.push(personData);
        
        entry.output.data_penjual = arrPenjual;
    }
    
    // 3. PIHAK PERSETUJUAN
    else if (form_id === 'frmPihaksetujuDukcapil' || data.jenis === 'WNI' || data.jenis === 'WNA') {
        let arrPersetujuan = Array.isArray(entry.output.data_pihak_persetujuan) ? entry.output.data_pihak_persetujuan : [];
        let personIndex = -1;

        const currentNik = (data.NIK || "").trim();
        const currentNama = (data.NAMA_LENGKAP || "").trim();

        if (currentNik !== "") {
            personIndex = arrPersetujuan.findIndex(p => p.nik === currentNik);
        } else if (currentNama !== "") {
            personIndex = arrPersetujuan.findIndex(p => p.nama === currentNama);
        }

        const personData = {
            nik: currentNik, nama: currentNama,
            alamat: data.ALAMAT || "", tempat_lahir: data.TEMPAT_LAHIR || "",
            tgl_lahir: data.TANGGAL_LAHIR || "", jenis_kelamin: data.JENIS_KELAMIN || "",
            pekerjaan: data.JENIS_PEKERJAAN || ""
        };

        if (personIndex !== -1) arrPersetujuan[personIndex] = { ...arrPersetujuan[personIndex], ...personData };
        else arrPersetujuan.push(personData);
        
        entry.output.data_pihak_persetujuan = arrPersetujuan;
    }
    
    // 4. PIHAK PEMBELI
    else if (form_id === 'frmtipepihak2Dukcapil' || form_id === 'frmInput2BadanHukum' || data.jenis === 'Pihak 2') {
        let arrPembeli = Array.isArray(entry.output.data_pembeli) ? entry.output.data_pembeli : [];
        let personIndex = -1;

        const currentNik = (data.NIK || "").trim();
        const currentNoAkta = (data.nomoridentitas || "").trim();
        const currentNama = (data.NAMA_LENGKAP || data.nama || "").trim();

        if (currentNik !== "") {
            personIndex = arrPembeli.findIndex(p => p.nomor_identitas === currentNik);
        } else if (currentNoAkta !== "") {
            personIndex = arrPembeli.findIndex(p => p.no_akta_pendirian === currentNoAkta);
        } else if (currentNama !== "") {
            personIndex = arrPembeli.findIndex(p => p.nama === currentNama);
        }

        const tipe = (data.tipepemohon === '1') ? 'perorangan' : 'badan hukum';
        let personData = {};

        if (tipe === 'badan hukum') {
            personData = {
                tipe_pembeli: "badan hukum",
                jenis: data.tipepemilikid || "", tipe: data.tipeusaha || "", nama: currentNama, 
                alamat: data.alamat || data.ALAMAT || "", kota: data.kota || data.NAMA_KABUPATEN || "", 
                npwp: data.npwp || "", no_akta_pendirian: currentNoAkta, tgl_akta_pendirian: data.TANGGAL_PENDIRIAN || ""
            };
        } else {
            personData = {
                tipe_pembeli: "perorangan",
                jenis_bukti_identitas: data.tipebuktiid || "", nomor_identitas: currentNik,
                nama: currentNama, alamat: data.ALAMAT || "", tempat_lahir: data.TEMPAT_LAHIR || "",
                tgl_lahir: data.TANGGAL_LAHIR || "", jenis_kelamin: data.JENIS_KELAMIN || "", pekerjaan: data.JENIS_PEKERJAAN || ""
            };
        }

        if (personIndex !== -1) arrPembeli[personIndex] = { ...arrPembeli[personIndex], ...personData };
        else arrPembeli.push(personData);
        
        entry.output.data_pembeli = arrPembeli;
    }

    // 5. MAPPING SERTIPIKAT (Mendukung Manual & Elektronik)
    else if (form_id === 'frmHAT' || data.jenisdokumen === 'AJB') {
        entry.output.sertifikat = {
            // Jika nibelektronik ada (sertif elektronik), gunakan itu. Jika tidak, gunakan nib (sertif manual).
            nib: data.nibelektronik || data.nib || "",
            // Jika kodesertipikat ada, gunakan itu. Jika tidak, gunakan nomorhak.
            nomor_hak_atau_kode_sertif: data.kodesertipikat || data.nomorhak || ""
        };
    }
    
    // 6. MAPPING PAJAK PBB, BPHTB, PPH
    else if (form_id === 'frmPBBDetail' || data.tipedokumen === 'PBB') {
        entry.output.pbb = { nop: data.nomor || "", tahun: data.tahun || "", luas: data.luas || "", njop: data.nilai || "" };
    }
    else if (form_id === 'frmBPHTB' || data.statusbphtb !== undefined) {
        entry.output.bphtb = { no_bukti_pembayaran: data.nomorbphtb || "" };
    }
    else if (form_id === 'frmSurat' || data.tipedokumen === 'SSP') {
        entry.output.pph = { npwp: data.npwp || "", no_suket: data.kodeverifikasi || "" };
    }

    // SIMPAN KEMBALI KE FILE JSON
    fs.writeFile(datasetFile, JSON.stringify(currentData, null, 4), (err) => {
        if (err) return res.status(500).json({ status: 'error' });
        console.log(`[Disimpan] ID Dokumen: ${current_akta_id} | Dari: ${form_id}`);
        res.status(200).json({ status: 'success' });
    });
});

app.listen(3000, () => {
    console.log('Collector Server berjalan. Menunggu data...');
});