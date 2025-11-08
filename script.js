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
        this.modalLoader = document.getElementById('modalLoader'); 
        
        // Announcement Button Elements
        this.announcementActionArea = document.getElementById('announcementActionArea');
        this.announcementActionButton = document.getElementById('announcementActionButton');

        // Configuration 
        this.WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbz8wbTBS0cBTPNCqbY6Vyi1Zwdl8JPqUQPwSvbwmK4GCjH2wWx2g-p7yzj1s8mAheFz/exec';
        this.ANNOUNCEMENT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1o8Z0bybLymUGlm7jfgpY4qHhwT9aC2mO141Xa1YlZ0Q/edit?gid=0#gid=0';
        
        // Geofencing Parameters
        this.params = new URLSearchParams(window.location.search);
        this.studioName = this.params.get('studio') || sessionStorage.getItem('currentStudio');
        
        this.target = { lat: null, lon: null, dist: null, url: null };

        this.isBypassMode = false;
        this.bypassUrl = null; 

        this.geofenceChecker.style.display = 'none';
        this.mainMenuCard.style.display = 'none';
        this.pageTitle.textContent = 'ประกาศ'; 

        document.body.classList.add('light-mode');
        document.body.classList.remove('dark-mode'); 
        document.body.style.overflow = 'hidden'; 

        this.init();
    }

    init() {
        this.bindEvents();

        // 🔑 แก้ปัญหา: ถ้ามี studioName ให้ล็อกอยู่หน้านั้น
        if (this.studioName) {
            sessionStorage.setItem('currentStudio', this.studioName);
            this.loadAnnouncement('studio_check', true);
        } else {
            this.showMainMenu();
        }
    }
    
    _onAnnouncementButtonClick = (event) => {
        const url = event.currentTarget.getAttribute('data-url');
        if (url) window.open(url, '_blank');
    }

    bindEvents() {
        this.retryButton.addEventListener('click', () => this.checkGeolocation());
        if (this.closeAnnouncementButton) {
            this.closeAnnouncementButton.addEventListener('click', () => this.closeAnnouncementModal());
        }
        this.announcementImage.addEventListener('load', () => { 
             this.modalLoader.style.display = 'none';
             this.announcementImage.style.display = 'block';
             this.announcementModalOverlay.classList.remove('initial-show');
        });
        this.announcementImage.addEventListener('error', () => {
             this.modalLoader.style.display = 'none';
             this.announcementModalOverlay.classList.remove('initial-show');
             if (this.announcementActionArea.style.display === 'none') {
                 this.closeAnnouncementModal(); 
             }
             this.announcementImage.style.display = 'none'; 
             console.error("Announcement Image failed to load or permission denied.");
        });
    }
    
    continueAppFlow() {
        this.isBypassMode = false;
        this.bypassUrl = null;
        this.showMainMenu();
    }
    
    showMainMenu() {
        sessionStorage.removeItem('currentStudio');
        this.geofenceChecker.style.display = 'none';
        this.mainMenuCard.style.display = 'flex';
        document.body.style.overflow = 'auto'; 
        document.body.classList.add('menu-scrollable');
        this.mainMenuCard.style.marginTop = '0';
        document.getElementById('mainContainerWrapper').style.marginTop = '0';
        document.body.classList.add('light-mode');
        document.body.classList.remove('dark-mode'); 
        this.pageTitle.textContent = 'เมนู Studio';
        document.getElementById('menuTitle').textContent = 'เมนู Studio'; 
        document.getElementById('mainMenuCard').querySelector('p').textContent = 'เลือก Studio ที่ต้องการเข้าถึง';
        this.fetchStudioNamesAndSetupMenu();
    }

    showGeofenceChecker() {
        this.mainMenuCard.style.display = 'none';
        this.geofenceChecker.style.display = 'flex';
        this.pageTitle.textContent = `ตรวจสอบ: ${this.studioName}`;
        document.body.style.overflow = 'hidden'; 
        document.body.classList.remove('menu-scrollable');
        this.mainMenuCard.style.marginTop = '';
        document.getElementById('mainContainerWrapper').style.marginTop = '';
        document.body.classList.add('light-mode'); 
        document.body.classList.remove('dark-mode'); 
    }
    
    async fetchStudioNamesAndSetupMenu() {
        try {
            const formData = new FormData();
            formData.append('action', 'get_studio_list');

            const response = await fetch(this.WEB_APP_URL, { method: 'POST', body: formData });
            const result = await response.json();
            if (result.success && result.studioNames?.length > 0) {
                this.setupMenuButtons(result.studioNames);
            } else {
                this.menuButtonsContainer.innerHTML = '<p style="color:#ef4444; text-align:center;">ไม่สามารถโหลดรายการ Studio ได้</p>';
            }
        } catch {
            this.menuButtonsContainer.innerHTML = '<p style="color:#ef4444; text-align:center;">การเชื่อมต่อ API ล้มเหลว</p>';
        }
    }

    setupMenuButtons(studioNames) {
        this.menuButtonsContainer.innerHTML = ''; 
        studioNames.forEach(name => {
            const btn = document.createElement('button');
            btn.className = 'neural-button';
            btn.type = 'button';
            btn.innerHTML = `<div class="button-bg"></div><span class="button-text">${name}</span><div class="button-glow"></div>`;
            btn.addEventListener('click', () => {
                sessionStorage.setItem('currentStudio', name);
                const url = `?studio=${encodeURIComponent(name)}`;
                window.location.href = url; // reload page แต่ไม่กลับเมนู
            });
            this.menuButtonsContainer.appendChild(btn);
        });
    }

    // --- Announcement Logic ---
    async loadAnnouncement(action, isInitialLoad = false) {
        if (!this.announcementModalOverlay) {
            if (action === 'studio_check') return this.fetchGeofenceConfig();
            if (action === 'geofence_check') return (this.showGeofenceChecker(), this.checkGeolocation());
            if (action === 'bypass_redirect' && this.bypassUrl) return window.open(this.bypassUrl, '_self');
            return this.continueAppFlow();
        }

        if (!isInitialLoad) {
            this.announcementModalOverlay.classList.remove('show', 'initial-show');
            this.announcementModalOverlay.style.display = 'none';
        }

        this.announcementImage.style.display = 'none';
        this.announcementActionArea.style.display = 'none';
        this.announcementModalOverlay.setAttribute('data-post-action', action);
        this.announcementActionButton.removeEventListener('click', this._onAnnouncementButtonClick);

        if (!isInitialLoad) {
            this.announcementModalOverlay.style.display = 'flex';
            this.modalLoader.style.display = 'flex';
            setTimeout(() => this.announcementModalOverlay.classList.add('show'), 50);
        } else {
            this.modalLoader.style.display = 'flex';
            this.announcementModalOverlay.classList.add('show');
        }

        try {
            // 1️⃣ ดึงข้อมูล geofence
            const formData = new FormData();
            formData.append('action', 'get_geofence_config');
            formData.append('studio', this.studioName || '');
            const response = await fetch(this.WEB_APP_URL, { method: 'POST', body: formData });
            const result = await response.json();

            this.pendingAction = { type: 'geofence', data: result };

            // --- 🔑 แก้ปัญหาปุ่มกากบาท ---
            if (result.hideClose) {
                this.closeAnnouncementButton.style.display = 'none';
            } else if (result.countdown && !isNaN(result.countdown)) {
                this.closeAnnouncementButton.style.display = 'none';
                this.startCountdown(result.countdown);
            } else {
                this.closeAnnouncementButton.style.display = 'flex';
            }

            // 2️⃣ โหลดประกาศ (รูป / ปุ่ม)
            const formData2 = new FormData();
            formData2.append('action', 'get_announcement_image');
            formData2.append('sheetUrl', this.ANNOUNCEMENT_SHEET_URL);
            const res2 = await fetch(this.WEB_APP_URL, { method: 'POST', body: formData2 });
            const ann = await res2.json();

            const hasImage = ann.success && ann.imageUrl;
            const hasButton = ann.success && ann.buttonText && ann.buttonUrl;

            if (hasImage) this.announcementImage.src = ann.imageUrl.trim();
            if (hasButton) {
                this.announcementActionArea.style.display = 'block';
                this.announcementActionButton.querySelector('.button-text').textContent = ann.buttonText.trim();
                this.announcementActionButton.setAttribute('data-url', ann.buttonUrl.trim());
                this.announcementActionButton.addEventListener('click', this._onAnnouncementButtonClick);
            }

        } catch (error) {
            console.error('Error fetching announcement:', error);
            this.closeAnnouncementModal();
        }
    }

    closeAnnouncementModal() {
        this.announcementModalOverlay.classList.remove('show', 'initial-show');
        this.announcementActionButton.removeEventListener('click', this._onAnnouncementButtonClick);
        const pending = this.pendingAction;

        setTimeout(() => {
            this.announcementModalOverlay.style.display = 'none';

            if (pending && pending.type === 'geofence') {
                const result = pending.data;

                if (!result.success) {
                    this.updateStatus('error', 'เกิดข้อผิดพลาด', result.message);
                    return;
                }

                if (result.needsCheck === false) {
                    this.geofenceChecker.style.display = 'none';
                    this.isBypassMode = true;
                    this.bypassUrl = result.formUrl;
                    window.open(this.bypassUrl, '_self');
                } else {
                    this.target = {
                        lat: result.targetLat,
                        lon: result.targetLon,
                        dist: result.maxDist,
                        url: result.formUrl
                    };
                    this.showGeofenceChecker();
                    this.checkGeolocation();
                }
            } else {
                this.continueAppFlow();
            }
        }, 300);
    }

    startCountdown(seconds) {
        const btn = this.closeAnnouncementButton;
        let remaining = seconds;
        btn.disabled = true;
        btn.style.display = 'flex'; // แสดงปุ่มตอนเริ่ม countdown
        btn.textContent = remaining;
        const timer = setInterval(() => {
            remaining--;
            btn.textContent = remaining;
            if (remaining <= 0) {
                clearInterval(timer);
                btn.textContent = '×';
                btn.disabled = false;
            }
        }, 1000);
    }

    // --- Geofencing Logic ---
    async fetchGeofenceConfig() {
        if (!this.studioName) return this.continueAppFlow(); 
        this.showGeofenceChecker(); 
        this.updateStatus('loading', `กำลังโหลดข้อมูล ${this.studioName}...`, 'กำลังติดต่อเซิร์ฟเวอร์เพื่อดึงพิกัดที่ถูกต้อง');
        
        const formData = new FormData();
        formData.append('action', 'get_geofence_config');
        formData.append('studio', this.studioName);

        try {
            const response = await fetch(this.WEB_APP_URL, { method: 'POST', body: formData });
            const result = await response.json();
            
            if (result.success) {
                if (result.needsCheck === false) {
                    this.geofenceChecker.style.display = 'none'; 
                    this.isBypassMode = true; 
                    this.bypassUrl = result.formUrl;
                    return window.open(this.bypassUrl, '_self'); 
                }
                this.target = { lat: result.targetLat, lon: result.targetLon, dist: result.maxDist, url: result.formUrl };
                this.checkGeolocation(); 
            } else {
                this.updateStatus('error', 'เกิดข้อผิดพลาด', result.message);
            }
        } catch {
            this.updateStatus('error', 'การเชื่อมต่อล้มเหลว', 'ไม่สามารถเชื่อมต่อกับ Web App ได้');
        }
    }

    checkGeolocation() {
        if (this.target.lat === null) return this.fetchGeofenceConfig();
        this.updateStatus('loading', `กำลังตรวจสอบตำแหน่ง ${this.studioName}...`, 'โปรดอนุญาต GPS');
        this.retryButton.style.display = 'none'; 
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => this.geoSuccess(pos),
                (err) => this.geoError(err),
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        } else {
            this.updateStatus('error', 'ไม่รองรับ', 'โทรศัพท์ของคุณไม่รองรับ GPS');
        }
    }
    
    geoSuccess(pos) {
        const userLat = pos.coords.latitude, userLon = pos.coords.longitude;
        const distance = this.calculateDistance(this.target.lat, this.target.lon, userLat, userLon);
        const distM = (distance * 1000).toFixed(0);
        if (distance <= this.target.dist) {
            this.updateStatus('success', 'ยืนยันสำเร็จ!', `ระยะทาง: ${distM} เมตร`);
            setTimeout(() => window.open(this.target.url, '_self'), 1000);
        } else {
            const maxM = this.target.dist * 1000;
            this.updateStatus('error', 'เข้าถึงถูกปฏิเสธ', `คุณอยู่ห่าง ${distM} เมตร (เกิน ${maxM} เมตร)`);
        }
    }
    
    geoError(error) {
        let msg = 'ไม่สามารถเข้าถึงตำแหน่ง GPS ได้';
        if (error.code === 1) msg += ' (ถูกปฏิเสธ)';
        else if (error.code === 2) msg += ' (ไม่พบตำแหน่ง)';
        else if (error.code === 3) msg += ' (หมดเวลา)';
        this.updateStatus('error', msg, 'โปรดเปิด GPS และอนุญาตตำแหน่ง');
        this.retryButton.style.display = 'flex';
    }
    
    calculateDistance(lat1, lon1, lat2, lon2) {
        const toRad = (x) => x * Math.PI / 180;
        const R = 6371;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    updateStatus(type, title, msg) {
        this.geofenceChecker.classList.remove('loading','error','success');
        this.geofenceChecker.classList.add(type);
        this.statusTitle.textContent = title;
        this.statusMessage.textContent = msg;
        if (type === 'loading') {
            this.statusIconContainer.innerHTML = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" fill="none" stroke="currentColor" stroke-width="8" r="35" stroke-dasharray="165 57" style="animation: rotate 1s linear infinite;"></circle></svg>';
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

document.addEventListener('DOMContentLoaded', () => new GeofenceApp());
