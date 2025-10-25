// Geofencing and Announcement Logic
class GeofenceApp {
    constructor() {
        // UI Elements
        this.statusCard = document.getElementById('geoStatusCard');
        this.statusTitle = document.getElementById('statusTitle');
        this.statusMessage = document.getElementById('statusMessage');
        this.loadingIcon = document.getElementById('loadingIcon');
        this.statusIconContainer = document.getElementById('statusIcon');
        this.retryButton = document.getElementById('retryButton');
        this.pageTitle = document.getElementById('pageTitle');

        // Announcement Modal Elements
        this.announcementModalOverlay = document.getElementById('announcementModalOverlay');
        this.announcementImage = document.getElementById('announcementImage');
        this.closeAnnouncementButton = document.getElementById('closeAnnouncementButton');

        // Configuration (ดึงค่าจาก Web App URL Parameter)
        this.WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxykVja0-XjwSaB2r4I_R6Gq-Z4MuMBV_QKVMpIqxZvvw9XlLh1imUf1OMBOivp9Zs/exec';
        this.ANNOUNCEMENT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1o8Z0bybLymUGlm7jfgpY4qHhwT9aC2mO141Xa1YlZ0Q/edit?gid=0#gid=0';
        
        // Geofencing Parameters (จาก Apps Script doGet)
        this.params = new URLSearchParams(window.location.search);
        this.studioName = this.params.get('studio');
        
        // Geofencing Target (ต้องดึงค่า Lat/Lon/Dist มาจาก Apps Script)
        this.target = { lat: null, lon: null, dist: null, url: null };

        this.init();
    }

    init() {
        if (!this.studioName) {
            this.updateStatus('error', 'ข้อผิดพลาด', 'ไม่พบรหัส Studio ในลิงก์ QR Code โปรดสร้าง QR Code ใหม่');
            return;
        }

        this.pageTitle.textContent = `ตรวจสอบ: ${this.studioName}`;
        this.statusTitle.textContent = `กำลังตรวจสอบตำแหน่ง ${this.studioName}...`;

        this.bindEvents();
        this.loadAnnouncement(); // 1. แสดงประกาศ
        this.fetchGeofenceConfig(); // 2. ดึงค่า Geofence จาก Apps Script
    }

    bindEvents() {
        this.retryButton.addEventListener('click', () => this.checkGeolocation());
        if (this.closeAnnouncementButton) {
            this.closeAnnouncementButton.addEventListener('click', () => this.closeAnnouncementModal());
        }
    }

    // --- Geofencing Logic ---

    async fetchGeofenceConfig() {
        this.updateStatus('loading', `กำลังโหลดข้อมูล ${this.studioName}...`, 'กำลังติดต่อเซิร์ฟเวอร์เพื่อดึงพิกัดที่ถูกต้อง');
        
        const formData = new FormData();
        formData.append('action', 'get_geofence_config');
        formData.append('studio', this.studioName);

        try {
            const response = await fetch(this.WEB_APP_URL, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                this.target.lat = result.targetLat;
                this.target.lon = result.targetLon;
                this.target.dist = result.maxDist;
                this.target.url = result.formUrl;
                
                this.checkGeolocation(); // เมื่อได้ค่าแล้ว เริ่มตรวจสอบ Geolocation
            } else {
                this.updateStatus('error', 'เกิดข้อผิดพลาด', result.message || 'ไม่สามารถดึงข้อมูลพิกัดจากเซิร์ฟเวอร์');
            }
        } catch (error) {
            this.updateStatus('error', 'การเชื่อมต่อล้มเหลว', 'ไม่สามารถเชื่อมต่อกับ Web App ได้');
        }
    }

    checkGeolocation() {
        if (this.target.lat === null) {
             // หากยังไม่ได้ค่า ให้เรียก fetch config ใหม่
             this.fetchGeofenceConfig();
             return;
        }
        
        this.updateStatus('loading', `กำลังตรวจสอบตำแหน่ง ${this.studioName}...`, 'โปรดอนุญาตการเข้าถึง GPS เพื่อดำเนินการต่อ');
        this.retryButton.style.display = 'none';

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => this.geoSuccess(position),
                (error) => this.geoError(error),
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        } else {
            this.updateStatus('error', 'เบราว์เซอร์ไม่รองรับ', 'โทรศัพท์ของคุณไม่รองรับ Geolocation หรือไม่ได้เปิด GPS');
        }
    }
    
    // Geolocation Success Handler
    geoSuccess(position) {
        const userLat = position.coords.latitude;
        const userLon = position.coords.longitude;
        
        const distance = this.calculateDistance(this.target.lat, this.target.lon, userLat, userLon);
        const distanceMeters = (distance * 1000).toFixed(0);

        if (distance <= this.target.dist) {
            // Success: อยู่ในรัศมี
            this.updateStatus('success', 'ยืนยันตำแหน่งสำเร็จ!', `ระยะทาง: ${distanceMeters} เมตร (นำไปสู่แบบฟอร์ม...)`);
            
            // นำทางไปยัง Google Form
            setTimeout(() => {
                 window.top.location.href = this.target.url;
            }, 1000);

        } else {
            // Error: อยู่นอกรัศมี
            const maxMeters = this.target.dist * 1000;
            this.updateStatus('error', 'เข้าถึงถูกปฏิเสธ', `คุณอยู่ห่าง ${distanceMeters} เมตร (เกิน ${maxMeters} เมตร) โปรดลองใหม่อีกครั้งในพื้นที่ที่กำหนด`);
        }
    }
    
    // Geolocation Error Handler
    geoError(error) {
        let errorMessage = 'ไม่สามารถเข้าถึงตำแหน่ง GPS ได้';
        if (error.code === 1) {
            errorMessage += ' (ถูกปฏิเสธ: ต้องเปิด GPS/อนุญาตการเข้าถึง)';
        } else if (error.code === 2) {
            errorMessage += ' (ไม่พบตำแหน่ง)';
        } else if (error.code === 3) {
            errorMessage += ' (หมดเวลาค้นหาตำแหน่ง)';
        }
        this.updateStatus('error', 'ข้อผิดพลาด GPS', errorMessage);
    }
    
    // Helper: Haversine Formula (คำนวณระยะทางเป็น กม.)
    calculateDistance(lat1, lon1, lat2, lon2) {
        function toRad(Value) { return Value * Math.PI / 180; }
        const R = 6371; // รัศมีโลกเป็น กม.
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const lat1Rad = toRad(lat1);
        const lat2Rad = toRad(lat2);

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1Rad) * Math.cos(lat2Rad); 
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
        
        return R * c;
    }

    // UI Update Helper
    updateStatus(type, title, message) {
        this.statusCard.classList.remove('loading', 'error', 'success');
        this.statusCard.classList.add(type);

        this.statusTitle.textContent = title;
        this.statusMessage.textContent = message;
        
        if (type === 'loading') {
            this.statusIconContainer.innerHTML = '<svg id="loadingIcon" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid" style="background: none; shape-rendering: auto;" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" fill="none" stroke="currentColor" stroke-width="8" r="35" stroke-dasharray="164.93361431346415 56.97787143782138" style="transform: rotate(0deg); animation: rotate 1s linear infinite;"></circle></svg>';
            this.retryButton.style.display = 'none';
        } else if (type === 'error') {
            this.statusIconContainer.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
            this.retryButton.style.display = 'flex';
        } else if (type === 'success') {
            this.statusIconContainer.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
            this.retryButton.style.display = 'none';
        }
    }
    
    // --- Announcement Logic ---

    async loadAnnouncement() {
        if (!this.announcementModalOverlay) return;

        try {
            const formData = new FormData();
            formData.append('action', 'get_announcement_image');
            formData.append('sheetUrl', this.ANNOUNCEMENT_SHEET_URL); 

            const response = await fetch(this.WEB_APP_URL, {
                method: 'POST',
                body: formData 
            });
            
            const result = await response.json();
            
            if (result.success && result.imageUrl && result.imageUrl.trim() !== '') {
                this.announcementImage.src = result.imageUrl.trim();
                
                // แสดง Modal
                this.announcementModalOverlay.style.display = 'flex'; 
                setTimeout(() => {
                    this.announcementModalOverlay.classList.add('show');
                }, 50); 
            }
        } catch (error) {
            console.error('Error fetching announcement:', error);
        }
    }

    closeAnnouncementModal() {
        this.announcementModalOverlay.classList.remove('show');
        setTimeout(() => {
            this.announcementModalOverlay.style.display = 'none';
        }, 300); 
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new GeofenceApp();
});
