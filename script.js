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
        this.loadingIcon = document.getElementById('loadingIcon');

        // Announcement Modal Elements
        this.announcementModalOverlay = document.getElementById('announcementModalOverlay');
        this.announcementImage = document.getElementById('announcementImage');
        this.closeAnnouncementButton = document.getElementById('closeAnnouncementButton');
        this.modalLoader = document.getElementById('modalLoader'); // Loader Element

        // Configuration 
        // ***** URL Apps Script ล่าสุดของคุณ *****
        this.WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzObYDke96Xn19aqriJAzeRYCAQeMPONNxpvMyvubBz435uHKa1LpTpC_C7bu835pQ/exec';
        this.ANNOUNCEMENT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1o8Z0bybLymUGlm7jfgpY4qHhwT9aC2mO141Xa1YlZ0Q/edit?gid=0#gid=0';
        
        // Geofencing Parameters
        this.params = new URLSearchParams(window.location.search);
        this.studioName = this.params.get('studio');
        
        // target.dist ถูกกำหนดเป็นเมตร (จาก K3)
        this.target = { lat: null, lon: null, dist: null, url: null }; 

        this.geofenceChecker.style.display = 'none';
        this.mainMenuCard.style.display = 'none';
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
        
        this.announcementImage.addEventListener('load', () => {
             this.modalLoader.style.display = 'none';
             this.announcementImage.style.display = 'block';
        });

        this.announcementImage.addEventListener('error', () => {
             this.modalLoader.style.display = 'none';
             this.announcementImage.style.display = 'none'; 
             this.closeAnnouncementModal(); 
             console.error("Announcement Image failed to load or permission denied.");
        });
    }
    
    // --- App Flow Control ---

    continueAppFlow() {
        this.pageTitle.textContent = 'เมนูผู้ดูแล Studio';
        
         if (this.studioName && this.studioName !== "ประกาศ") {
            this.showGeofenceChecker();
            this.fetchGeofenceConfig(); // โหลด Geofence Config ก่อน แล้วจึงเริ่ม checkGeolocation
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
        document.body.classList.add('light-mode'); 
    }

    showGeofenceChecker() {
        this.mainMenuCard.style.display = 'none';
        this.geofenceChecker.style.display = 'flex';
        this.pageTitle.textContent = `ตรวจสอบ: ${this.studioName}`;
        document.body.classList.remove('light-mode'); 
        this.setStatus('กำลังตรวจสอบตำแหน่ง Studio...', 'โปรดอนุญาตให้เข้าถึงตำแหน่ง GPS ของคุณ', 'loading', false);
    }

    setupMenuButtons() {
        const studioNames = ["Studio 1", "Studio 2", "Studio 3", "Studio 4", "Studio 5", "ประกาศ"];
        
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
            if (name === "ประกาศ") {
                newButton.querySelector('.button-text').textContent = name;
            }

            newButton.addEventListener('click', () => {
                if (name === "ประกาศ") {
                    this.loadAnnouncement();
                } else {
                    window.location.href = `?studio=${encodeURIComponent(name)}`;
                }
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
                this.announcementModalOverlay.style.display = 'flex'; 
                this.modalLoader.style.display = 'flex'; 
                this.announcementImage.style.display = 'none'; // ซ่อนรูปเก่า
                setTimeout(() => {
                    this.announcementModalOverlay.classList.add('show');
                }, 50);
                
                this.announcementImage.src = result.imageUrl.trim(); 
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

    // --- Geofencing Logic (โค้ดที่เพิ่มเข้ามา) ---

    // 1. โหลด Geofence Config จาก Apps Script
    async fetchGeofenceConfig() {
        this.setStatus('กำลังโหลดข้อมูล...', `กำลังดึงข้อมูลตำแหน่งของ ${this.studioName}`, 'loading', false);
        try {
            const formData = new FormData();
            formData.append('action', 'get_geofence_config');
            formData.append('studioName', this.studioName); // Apps Script ใช้ studioName
            formData.append('sheetUrl', this.ANNOUNCEMENT_SHEET_URL); 

            const response = await fetch(this.WEB_APP_URL, {
                method: 'POST',
                body: formData 
            });
            
            const result = await response.json();
            
            // Apps Script ส่ง: lat, lon, radius, url
            if (result.success && result.lat && result.lon && result.radius && result.url) {
                this.target.lat = parseFloat(result.lat);
                this.target.lon = parseFloat(result.lon);
                this.target.dist = parseFloat(result.radius); // รับค่าเป็นเมตร
                this.target.url = result.url;
                
                // เมื่อได้ Config แล้ว ให้เริ่มตรวจสอบตำแหน่ง
                this.checkGeolocation();
            } else {
                this.setStatus('ข้อผิดพลาด ⚠️', `ไม่พบข้อมูล Geofence สำหรับ Studio นี้ (${result.message || 'Unknown'})`, 'error', true);
            }
        } catch (error) {
            console.error('Error fetching geofence config:', error);
            this.setStatus('ข้อผิดพลาดเครือข่าย 🌐', 'ไม่สามารถเชื่อมต่อเพื่อดึงข้อมูล Geofence ได้', 'error', true);
        }
    }

    // 2. ตรวจสอบตำแหน่ง GPS
    checkGeolocation() {
        this.setStatus('กำลังตรวจสอบตำแหน่ง Studio...', 'โปรดอนุญาตให้เข้าถึงตำแหน่ง GPS ของคุณ', 'loading', false);
        this.retryButton.style.display = 'none';

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => this.successHandler(position),
                (error) => this.errorHandler(error),
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        } else {
            this.setStatus('ไม่สำเร็จ 🚫', 'เบราว์เซอร์ไม่รองรับ Geolocation', 'error', true);
        }
    }

    // 3. เมื่อได้ตำแหน่งสำเร็จ
    successHandler(position) {
        const userLat = position.coords.latitude;
        const userLon = position.coords.longitude;
        
        const distance = this.calculateDistance(
            userLat, userLon, 
            this.target.lat, this.target.lon
        ); // ผลลัพธ์เป็นเมตร
        
        if (distance <= this.target.dist) {
            // อยู่ในพื้นที่ที่กำหนด
            this.setStatus('เข้าสู่ระบบสำเร็จ ✅', `คุณอยู่ในพื้นที่ของ ${this.studioName}`, 'success', false);
            setTimeout(() => {
                window.location.href = this.target.url;
            }, 500);
        } else {
            // ไม่อยู่ในพื้นที่
            const distInMeters = Math.round(distance);
            this.setStatus(
                'ไม่อยู่ในพื้นที่ ❌', 
                `คุณอยู่ห่างจาก Studio ${distInMeters} เมตร (รัศมี: ${this.target.dist} เมตร)`, 
                'error', 
                true
            );
        }
    }
    
    // 4. เมื่อเกิดข้อผิดพลาดในการรับตำแหน่ง
    errorHandler(error) {
        let message = '';
        let title = 'ไม่สำเร็จ ❌';
        
        switch(error.code) {
            case error.PERMISSION_DENIED:
                message = "คุณปฏิเสธการเข้าถึงตำแหน่ง โปรดเปิด Location Service และลองใหม่อีกครั้ง";
                break;
            case error.POSITION_UNAVAILABLE:
                message = "ไม่สามารถระบุตำแหน่งปัจจุบันได้";
                break;
            case error.TIMEOUT:
                message = "ใช้เวลาในการตรวจสอบนานเกินไป โปรดลองใหม่อีกครั้ง";
                break;
            case error.UNKNOWN_ERROR:
                message = "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
                break;
            default:
                message = "เกิดข้อผิดพลาดในการเข้าถึง GPS";
        }
        this.setStatus(title, message, 'error', true);
    }

    // 5. อัปเดต UI ของ Status Card
    setStatus(title, message, iconType, showRetry) {
        this.statusTitle.textContent = title;
        this.statusMessage.textContent = message;
        this.retryButton.style.display = showRetry ? 'flex' : 'none';
        
        // ล้าง Icon ปัจจุบัน
        this.statusIconContainer.innerHTML = '';
        
        let iconHtml = '';
        if (iconType === 'loading') {
            iconHtml = `<svg id="loadingIcon" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid" style="background: none; shape-rendering: auto;" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" fill="none" stroke="currentColor" stroke-width="8" r="35" stroke-dasharray="164.93361431346415 56.97787143782138" style="transform: rotate(0deg); animation: rotate 1s linear infinite;"></circle>
            </svg>`;
        } else if (iconType === 'success') {
            iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="color: #10b981;"><path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.532-1.267-1.268a.75.75 0 0 0-1.06 1.06l1.794 1.793a.75.75 0 0 0 1.06-.01L15.61 10.186Z" clip-rule="evenodd" /></svg>`;
        } else if (iconType === 'error') {
            iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="color: #ef4444;"><path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-1.72 6.97a.75.75 0 1 0-1.06 1.06L10.94 12l-1.73 1.72a.75.75 0 1 0 1.06 1.06L12 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L13.06 12l1.73-1.72a.75.75 0 1 0-1.06-1.06L12 10.94l-1.72-1.72Z" clip-rule="evenodd" /></svg>`;
        }
        
        this.statusIconContainer.innerHTML = iconHtml;
    }
    
    // 6. คำนวณระยะทาง (Haversine Formula) - ผลลัพธ์เป็นเมตร
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000; // รัศมีโลกเป็นเมตร
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c; // ระยะทางเป็นเมตร
        return distance;
    }

    deg2rad(deg) {
        return deg * (Math.PI / 180);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new GeofenceApp();
});
