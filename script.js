// Geofencing and Announcement Logic
class GeofenceApp {
    constructor() {
        // UI Elements
        this.mainMenuCard = document.getElementById('mainMenuCard');
        this.geofenceChecker = document.getElementById('geofenceChecker');
        this.menuButtonsContainer = document.getElementById('adminMenuButtons');
        
        this.statusTitle = document.getElementById('statusTitle');
        this.statusMessage = document.getElementById('statusMessage');
        this.statusIconContainer = document.getElementById('statusIcon');
        this.retryButton = document.getElementById('retryButton');
        this.pageTitle = document.getElementById('pageTitle');

        // Announcement Modal Elements
        this.announcementModalOverlay = document.getElementById('announcementModalOverlay');
        this.announcementImage = document.getElementById('announcementImage');
        this.closeAnnouncementButton = document.getElementById('closeAnnouncementButton');

        // Configuration 
        // ***** URL Apps Script ล่าสุดของคุณ *****
        this.WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzXgIHCQBa4QZH4CUQOJ0SwLeYKOfx6o1QjDrll-z5YDVFpn8Xo5GQNvUzM20g3zBcS/exec';
        this.ANNOUNCEMENT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1o8Z0bybLymUGlm7jfgpY4qHhwT9aC2mO141Xa1YlZ0Q/edit?gid=0#gid=0';
        
        // Geofencing Parameters
        this.params = new URLSearchParams(window.location.search);
        this.studioName = this.params.get('studio');
        
        this.target = { lat: null, lon: null, dist: null, url: null };

        // ซ่อนทุกอย่างไว้ก่อน แล้วให้ loadAnnouncement เป็นผู้แสดงผล
        this.geofenceChecker.style.display = 'none';
        this.mainMenuCard.style.display = 'none';

        // *** การแก้ไขที่สำคัญ: ตั้ง Title หน้าเริ่มต้นเป็น 'ประกาศ' ***
        this.pageTitle.textContent = 'ประกาศ'; 
        
        this.init();
    }

    init() {
        this.bindEvents();
        // เริ่มต้นด้วยการโหลดประกาศเสมอ
        this.loadAnnouncement(); 
    }

    bindEvents() {
        this.retryButton.addEventListener('click', () => this.checkGeolocation());
        if (this.closeAnnouncementButton) {
            this.closeAnnouncementButton.addEventListener('click', () => this.closeAnnouncementModal());
        }
    }
    
    // --- App Flow Control ---

    continueAppFlow() {
        // *** การแก้ไขที่สำคัญ: เปลี่ยน Title เมื่อเข้าสู่ Flow หลัก ***
        this.pageTitle.textContent = 'เมนูผู้ดูแล Studio';
        
         if (this.studioName) {
            this.showGeofenceChecker();
            this.fetchGeofenceConfig(); 
        } else {
            this.showMainMenu();
            this.setupMenuButtons();
        }
    }

    // --- UI/Mode Handlers ---

    showMainMenu() {
        this.geofenceChecker.style.display = 'none';
        this.mainMenuCard.style.display = 'flex';
        this.pageTitle.textContent = 'เมนูผู้ดูแล Studio';
    }

    showGeofenceChecker() {
        this.mainMenuCard.style.display = 'none';
        this.geofenceChecker.style.display = 'flex';
        this.pageTitle.textContent = `ตรวจสอบ: ${this.studioName}`;
    }

    setupMenuButtons() {
        const studioNames = ["Studio 1", "Studio 2", "Studio 3", "Studio 4", "Studio 5", "STUDIO"];
        
        studioNames.forEach(name => {
            const newButton = document.createElement('button');
            newButton.className = 'neural-button';
            newButton.type = 'button';
            newButton.style.marginTop = '0';
            
            newButton.innerHTML = `
                <div class="button-bg"></div>
                <span class="button-text">เข้าสู่ ${name}</span>
                <div class="button-glow"></div>
            `;

            newButton.addEventListener('click', () => {
                window.location.href = `?studio=${encodeURIComponent(name)}`;
            });
            
            this.menuButtonsContainer.appendChild(newButton);
        });
    }

    // --- Announcement Logic ---

    async loadAnnouncement() {
        if (!this.announcementModalOverlay) {
            this.continueAppFlow();
            return;
        }
        
        this.announcementModalOverlay.classList.remove('show');

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
                this.announcementModalOverlay.style.display = 'flex'; 
                setTimeout(() => {
                    this.announcementModalOverlay.classList.add('show');
                }, 50); 
            } else {
                this.continueAppFlow();
            }
        } catch (error) {
            console.error('Error fetching announcement:', error);
            this.continueAppFlow();
        }
    }

    closeAnnouncementModal() {
        this.announcementModalOverlay.classList.remove('show');
        setTimeout(() => {
            this.announcementModalOverlay.style.display = 'none';
            this.continueAppFlow(); 
        }, 300); 
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
                // *** การแก้ไขที่สำคัญ: ตรวจสอบว่าต้อง Geofence Check หรือไม่ ***
                if (result.needsCheck === false) {
                     this.updateStatus('success', 'เข้าสู่ Studio', 'ข้ามการตรวจสอบตำแหน่ง (นำไปสู่แบบฟอร์ม...)');
                     setTimeout(() => {
                        window.top.location.href = result.formUrl;
                     }, 1000);
                     return;
                }
                
                this.target.lat = result.targetLat;
                this.target.lon = result.targetLon;
                this.target.dist = result.maxDist;
                this.target.url = result.formUrl;
                
                this.checkGeolocation(); 
            } else {
                this.updateStatus('error', 'เกิดข้อผิดพลาด', result.message || 'ไม่สามารถดึงข้อมูลพิกัดจากเซิร์ฟเวอร์');
            }
        } catch (error) {
            this.updateStatus('error', 'การเชื่อมต่อล้มเหลว', 'ไม่สามารถเชื่อมต่อกับ Web App ได้');
        }
    }

    checkGeolocation() {
        if (this.target.lat === null) {
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
    
    geoSuccess(position) {
        const userLat = position.coords.latitude;
        const userLon = position.coords.longitude;
        const distance = this.calculateDistance(this.target.lat, this.target.lon, userLat, userLon);
        const distanceMeters = (distance * 1000).toFixed(0);

        if (distance <= this.target.dist) {
            this.updateStatus('success', 'ยืนยันตำแหน่งสำเร็จ!', `ระยะทาง: ${distanceMeters} เมตร (นำไปสู่แบบฟอร์ม...)`);
            setTimeout(() => {
                 window.top.location.href = this.target.url;
            }, 1000);

        } else {
            const maxMeters = this.target.dist * 1000;
            this.updateStatus('error', 'เข้าถึงถูกปฏิเสธ', `คุณอยู่ห่าง ${distanceMeters} เมตร (เกิน ${maxMeters} เมตร) โปรดลองใหม่อีกครั้งในพื้นที่ที่กำหนด`);
        }
    }
    
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
    
    calculateDistance(lat1, lon1, lat2, lon2) {
        function toRad(Value) { return Value * Math.PI / 180; }
        const R = 6371;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const lat1Rad = toRad(lat1);
        const lat2Rad = toRad(lat2);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1Rad) * Math.cos(lat2Rad); 
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
        return R * c;
    }

    updateStatus(type, title, message) {
        this.geofenceChecker.classList.remove('loading', 'error', 'success');
        this.geofenceChecker.classList.add(type);

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
}

document.addEventListener('DOMContentLoaded', () => {
    new GeofenceApp();
});
