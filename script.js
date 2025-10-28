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
        
        // NEW: Announcement Button Elements
        this.announcementActionArea = document.getElementById('announcementActionArea');
        this.announcementActionButton = document.getElementById('announcementActionButton');

        // Configuration 
        // URL Apps Script ล่าสุดของคุณ (อัปเดตแล้ว)
        this.WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyBz6JISCmdhxPlcUp3MVRT-TvZlYFZzbkk6eg5iQss5tASfjYy13JRODKZYPgEb7LS/exec';
        this.ANNOUNCEMENT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1o8Z0bybLymUGlm7jfgpY4qHhwT9aC2mO141Xa1YlZ0Q/edit?gid=0#gid=0';
        
        // Geofencing Parameters
        this.params = new URLSearchParams(window.location.search);
        this.studioName = this.params.get('studio');
        
        this.target = { lat: null, lon: null, dist: null, url: null };

        this.isBypassMode = false;
        this.bypassUrl = null; 

        this.geofenceChecker.style.display = 'none';
        this.mainMenuCard.style.display = 'none';
        this.pageTitle.textContent = 'ประกาศ'; 

        // บังคับใช้ Light Mode ตั้งแต่เริ่มต้น
        document.body.classList.add('light-mode');
        document.body.classList.remove('dark-mode'); 

        // *** แก้ไข: เพิ่มการจัดการ body overflow สำหรับ Menu/Checker ***
        document.body.style.overflow = 'hidden'; 
        // -----------------------------------------------------------

        this.init();
    }

    init() {
        this.bindEvents();
        
        // ถ้ามี studioName ต้องระบุ action เป็น 'studio_check' เพื่อให้รู้ว่าหลังปิด Modal ต้องไปเช็คต่อ
        // ถ้าไม่มี studioName ให้เป็น 'main_menu'
        const initialAction = this.studioName ? 'studio_check' : 'main_menu';
        
        // โหลดประกาศตั้งแต่แรก (แสดง Loader ทันที)
        this.loadAnnouncement(initialAction, true); 
    }
    
    _onAnnouncementButtonClick = (event) => {
        const url = event.currentTarget.getAttribute('data-url');
        if (url) {
            window.open(url, '_blank');
        }
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
    
    // --- App Flow Control ---

    continueAppFlow() {
        this.isBypassMode = false;
        this.bypassUrl = null;
        this.showMainMenu();
    }
    
    // --- UI/Mode Handlers ---

    showMainMenu() {
        this.geofenceChecker.style.display = 'none';
        this.mainMenuCard.style.display = 'flex';
        
        // *** แก้ไข: ทำให้หน้าเมนูสามารถเลื่อนได้และจัดชิดบน ***
        document.body.style.overflow = 'auto'; 
        document.body.classList.add('menu-scrollable');
        
        // NEW: บังคับให้ Menu Card (login-container/status-card) เริ่มต้นที่ขอบบน
        this.mainMenuCard.style.marginTop = '0';
        document.getElementById('mainContainerWrapper').style.marginTop = '0';
        // -------------------------------------------------------------------------

        // บังคับใช้ Light Mode
        document.body.classList.add('light-mode');
        document.body.classList.remove('dark-mode'); 
        
        // *** แก้ไข: เปลี่ยนชื่อหน้าเป็น 'เมนู Studio' ***
        this.pageTitle.textContent = 'เมนู Studio';
        document.getElementById('menuTitle').textContent = 'เมนู Studio'; 
        document.getElementById('mainMenuCard').querySelector('p').textContent = 'เลือก Studio ที่ต้องการเข้าถึง';
        // -------------------------------------------------

        this.fetchStudioNamesAndSetupMenu();
    }

    showGeofenceChecker() {
        this.mainMenuCard.style.display = 'none';
        this.geofenceChecker.style.display = 'flex';
        this.pageTitle.textContent = `ตรวจสอบ: ${this.studioName}`;

        // *** แก้ไข: ล็อคหน้าจอไม่ให้เลื่อนเมื่อเข้าสู่ Geofence Checker (ลบ Class และรีเซ็ต margin) ***
        document.body.style.overflow = 'hidden'; 
        document.body.classList.remove('menu-scrollable');
        this.mainMenuCard.style.marginTop = '';
        document.getElementById('mainContainerWrapper').style.marginTop = '';
        // ----------------------------------------------------------------------------
        
        // *** แก้ไข: บังคับใช้ Light Mode สำหรับหน้าตรวจสอบพิกัด (ตามคำขอ) ***
        document.body.classList.add('light-mode'); 
        document.body.classList.remove('dark-mode'); 
    }
    
    async fetchStudioNamesAndSetupMenu() {
        try {
            const formData = new FormData();
            formData.append('action', 'get_studio_list');

            const response = await fetch(this.WEB_APP_URL, {
                method: 'POST',
                body: formData 
            });
            
            const result = await response.json();
            
            if (result.success && result.studioNames && result.studioNames.length > 0) {
                this.setupMenuButtons(result.studioNames);
            } else {
                this.menuButtonsContainer.innerHTML = '<p style="color:#ef4444; text-align: center;">ไม่สามารถโหลดรายการ Studio ได้ (โปรดตรวจสอบชีต \'Studio\' และสิทธิ์การเข้าถึง)</p>';
                console.error("No studio names returned or failed to fetch.");
            }

        } catch (error) {
            this.menuButtonsContainer.innerHTML = '<p style="color:#ef4444; text-align: center;">การเชื่อมต่อ API ล้มเหลว</p>';
            console.error("Failed to fetch studio list:", error);
        }
    }

    setupMenuButtons(studioNames) {
        this.menuButtonsContainer.innerHTML = ''; 
        
        studioNames.forEach(name => {
            const newButton = document.createElement('button');
            newButton.className = 'neural-button';
            newButton.type = 'button';
            newButton.style.marginTop = '0';
            
            newButton.innerHTML = `
                <div class="button-bg"></div>
                <span class="button-text">${name}</span> <div class="button-glow"></div>
            `;

            newButton.addEventListener('click', () => {
                // *** แก้ไข: เปิดหน้าต่างใหม่สำหรับลิงก์เมนูหลัก ***
                const url = `?studio=${encodeURIComponent(name)}`;
                window.open(url, '_blank'); 
            });
            
            this.menuButtonsContainer.appendChild(newButton);
        });
    }

    // --- Announcement Logic (พร้อม Timeout) ---

    // action: 'main_menu', 'studio_check', 'geofence_check', 'bypass_redirect'
    async loadAnnouncement(action, isInitialLoad = false) {
        if (!this.announcementModalOverlay) {
             if (action === 'studio_check') { this.fetchGeofenceConfig(); }
             else if (action === 'geofence_check') { this.showGeofenceChecker(); this.checkGeolocation(); }
             else if (action === 'bypass_redirect' && this.bypassUrl) { window.open(this.bypassUrl, '_self'); } // ใช้ _self สำหรับ redirect ปลายทาง
             else { this.continueAppFlow(); }
             return;
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
            setTimeout(() => {
                this.announcementModalOverlay.classList.add('show');
            }, 50);
        } else {
             this.modalLoader.style.display = 'flex';
             this.announcementModalOverlay.classList.add('show');
        }


        try {
            const formData = new FormData();
            formData.append('action', 'get_announcement_image');
            formData.append('sheetUrl', this.ANNOUNCEMENT_SHEET_URL); 

            const response = await fetch(this.WEB_APP_URL, {
                method: 'POST',
                body: formData 
            });
            
            const result = await response.json();
            
            const hasImage = result.success && result.imageUrl && result.imageUrl.trim() !== '';
            const hasButton = result.success && result.buttonText && result.buttonUrl; 

            if (hasImage || hasButton) {
                
                if (hasImage) {
                    this.announcementImage.src = result.imageUrl.trim(); 
                } else {
                    this.modalLoader.style.display = 'none'; 
                    this.announcementModalOverlay.classList.remove('initial-show'); 
                }
                
                if (hasButton) {
                    this.announcementActionArea.style.display = 'block';
                    this.announcementActionButton.style.display = 'flex';
                    this.announcementActionButton.querySelector('.button-text').textContent = result.buttonText.trim();
                    this.announcementActionButton.setAttribute('data-url', result.buttonUrl.trim());
                    this.announcementActionButton.addEventListener('click', this._onAnnouncementButtonClick);
                }

                const loadTimeout = setTimeout(() => {
                    const isImageLoading = hasImage && (this.modalLoader.style.display !== 'none' || this.announcementImage.style.display === 'none');
                    if (isImageLoading && !hasButton) {
                        console.warn("Announcement load timeout. Skipping image and continuing flow.");
                        this.announcementImage.src = ''; 
                        this.modalLoader.style.display = 'none';
                        this.closeAnnouncementModal(); 
                    } else if (isImageLoading && hasButton) {
                        this.announcementImage.src = '';
                        this.modalLoader.style.display = 'none';
                    }
                }, 5000); 
                
            } else {
                this.closeAnnouncementModal();
            }
        } catch (error) {
            console.error('Error fetching announcement:', error);
            this.closeAnnouncementModal();
        }
    }

    closeAnnouncementModal() {
        this.announcementModalOverlay.classList.remove('show', 'initial-show');
        
        this.announcementActionButton.removeEventListener('click', this._onAnnouncementButtonClick);
        
        const postAction = this.announcementModalOverlay.getAttribute('data-post-action');
        
        setTimeout(() => {
            this.announcementModalOverlay.style.display = 'none';
            
            if (postAction === 'bypass_redirect' && this.bypassUrl) {
                // ใช้ _self เพื่อให้ redirect ในหน้าต่างเดิม (ตาม Flow การใช้งาน)
                window.open(this.bypassUrl, '_self'); 
            } else if (postAction === 'geofence_check') {
                this.showGeofenceChecker();
                this.checkGeolocation();
            } else if (postAction === 'studio_check') {
                 // หลังปิดประกาศครั้งแรก ให้ไปเช็ค config ทันที
                 this.fetchGeofenceConfig();
            } else { 
                this.continueAppFlow(); 
            }
        }, 300); 
    }

    // --- Geofencing Logic ---

    async fetchGeofenceConfig() {
        if (!this.studioName) {
            this.continueAppFlow(); 
            return;
        }

        // แสดง Geofence Checker ก่อนเรียก API
        this.showGeofenceChecker(); 

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
                if (result.needsCheck === false) {
                    // โหมด Bypass: ซ่อน Geofence Checker และ Redirect ทันที
                    this.geofenceChecker.style.display = 'none'; 
                    this.isBypassMode = true; 
                    this.bypassUrl = result.formUrl;
                    
                    window.open(this.bypassUrl, '_self'); 
                    return;
                }
                
                // Geofence Check Required
                this.target.lat = result.targetLat;
                this.target.lon = result.targetLon;
                this.target.dist = result.maxDist;
                this.target.url = result.formUrl;
                
                // เริ่มเช็คพิกัด
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
                 window.open(this.target.url, '_self');
            }, 1000);

        } else {
            const maxMeters = this.target.dist * 1000;
            this.updateStatus('error', 'เข้าถึงถูกปฏิเสธ', `คุณอยู่ห่าง ${distanceMeters} เมตร (เกิน ${maxMeters} เมตร) โปรดลองใหม่อีกครั้งในพื้นที่ที่กำหนด`);
        }
    }
    
    geoError(error) {
        let errorMessage = 'ไม่สามารถเข้าถึงตำแหน่ง GPS ได้';
        let customMessage = 'โปรดตรวจสอบว่าได้เปิด GPS และอนุญาตการเข้าถึงตำแหน่งสำหรับเว็บไซต์นี้';

        if (error.code === 1) {
            errorMessage += ' (ถูกปฏิเสธ)';
        } else if (error.code === 2) {
            errorMessage += ' (ไม่พบตำแหน่ง)';
        } else if (error.code === 3) {
            errorMessage += ' (หมดเวลาค้นหา)';
        }
        
        this.updateStatus('error', errorMessage, customMessage);
        this.retryButton.style.display = 'flex'; 
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
