// Geofencing and Announcement Logic
class GeofenceApp {
    constructor() {
        // UI Elements
        this.mainContainerWrapper = document.getElementById('mainContainerWrapper');
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
        this.countdownText = document.getElementById('countdownText'); 
        this.closeIcon = this.closeAnnouncementButton.querySelector('.close-icon'); 
        this.modalLoader = document.getElementById('modalLoader'); 
        
        // NEW: Announcement Button Elements
        this.announcementActionArea = document.getElementById('announcementActionArea');
        this.announcementActionButton = document.getElementById('announcementActionButton');

        // Configuration 
        // 🚨 NEW API URL: ใช้ URL ของ Web App ที่ทำหน้าที่เป็น API Backend
        this.WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwOJOyWKkAw6Cdxs5BPr23xZfo-A1dC64anxE6L5VoOjiF1gt4S-c9eEV--CZqn736FIw/exec';
        // ⚠️ ลบ: this.ANNOUNCEMENT_SHEET_URL ไม่จำเป็นอีกต่อไป เพราะ API จัดการเอง
        
        // Geofencing Parameters
        this.params = new URLSearchParams(window.location.search);
        this.studioName = this.params.get('studio');
        
        this.target = { lat: null, lon: null, dist: null, url: null };

        this.isBypassMode = false;
        this.bypassUrl = null; 
        
        // NEW: ตัวแปรสำหรับควบคุม Announcement
        this.announcementControl = {
            hideCloseBtn: false, 
            countdownSec: 0 
        };
        this.isAnnouncementActive = false; 
        this.countdownInterval = null; 

        // *** FIXED: ซ่อนทุกอย่างที่เกี่ยวกับหน้าหลักไว้ตั้งแต่เริ่มต้น ***
        this.geofenceChecker.style.display = 'none';
        this.mainMenuCard.style.display = 'none';
        this.mainContainerWrapper.style.display = 'none'; 
        
        this.pageTitle.textContent = 'ประกาศ'; 
        this.closeAnnouncementButton.style.display = 'none'; 
        
        // *** FIXED: บังคับให้ Body เป็น Light Mode (พื้นหลังขาว) เสมอ ***
        document.body.classList.add('light-mode');
        document.body.classList.remove('dark-mode'); 
        document.body.style.backgroundColor = '#f8fafc'; 
        document.body.style.overflow = 'hidden'; 

        this.init();
    }

    init() {
        this.bindEvents();
        
        if (this.studioName) {
            // Action หลังปิดประกาศ: 'geofence_check' 
            this.loadStudioConfigAndAnnouncement('geofence_check');
        } else {
            // Initial Load: Admin Mode
            const initialAction = 'main_menu';
            const initialControl = { hideCloseBtn: false, countdownSec: 0 }; 
            this.loadAnnouncement(initialAction, true, initialControl); 
        }
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
        
        // เมื่อภาพโหลดเสร็จ (สำเร็จ)
        this.announcementImage.addEventListener('load', () => { 
             this.modalLoader.style.display = 'none';
             this.announcementImage.style.display = 'block';
             
             this.announcementModalOverlay.classList.remove('initial-show');
             
             const postAction = this.announcementModalOverlay.getAttribute('data-post-action');
             this.startCloseButtonControl(postAction);
        });

        // เมื่อภาพโหลดเสร็จ (ล้มเหลว)
        this.announcementImage.addEventListener('error', () => {
             this.modalLoader.style.display = 'none';
             this.announcementModalOverlay.classList.remove('initial-show');
             this.announcementImage.style.display = 'none'; 
             
             const postAction = this.announcementModalOverlay.getAttribute('data-post-action');
             this.startCloseButtonControl(postAction);

             if (this.announcementActionArea.style.display === 'none' && !this.announcementImage.src) {
                 this.isAnnouncementActive = false;
                 this.closeAnnouncementModal(); 
             }
             console.error("Announcement Image failed to load or permission denied.");
        });
    }
    
    // --- App Flow Control ---

    async loadStudioConfigAndAnnouncement(action) {
        // 1. ดึงค่า config จาก Apps Script (รวมถึง D และ E)
        const configResult = await this.fetchGeofenceConfig(true); 

        // 2. ตั้งค่า Announcement Control 
        if (configResult && configResult.announcementControl) {
            this.announcementControl = configResult.announcementControl;
            
            this.target.lat = configResult.targetLat;
            this.target.lon = configResult.targetLon;
            this.target.dist = configResult.maxDist;
            this.target.url = configResult.formUrl;
            this.isBypassMode = configResult.needsCheck === false;
            this.bypassUrl = configResult.formUrl;

        } else {
            this.announcementControl = { hideCloseBtn: false, countdownSec: 0 }; 
            if (action === 'geofence_check') {
                alert("ไม่สามารถโหลดข้อมูล Studio ได้ หรือ Studio ไม่อยู่ในรายการ");
                // 🚨 FIX: Redirect กลับหน้าหลัก (Admin Menu)
                window.location.href = window.location.origin + window.location.pathname; 
                return;
            }
        }
        
        // 3. ตรวจสอบ Bypass Mode ทันที (ก่อนแสดงประกาศ)
        if (this.isBypassMode) {
             action = 'bypass_redirect';
        }
        
        // 4. โหลดประกาศด้วยค่าควบคุมที่ถูกต้อง (แสดงประกาศแค่ 1 ครั้ง)
        this.loadAnnouncement(action, true, this.announcementControl); 
    }
    
    continueAppFlow() {
        this.isBypassMode = false;
        this.bypassUrl = null;
        this.showMainMenu();
    }
    
    // --- UI/Mode Handlers (ไม่เปลี่ยนแปลง) ---

    showMainMenu() {
        document.body.classList.add('light-mode'); 
        document.body.classList.remove('dark-mode'); 
        document.body.style.backgroundColor = '#f8fafc'; 
        
        this.mainContainerWrapper.style.display = 'flex'; 
        this.geofenceChecker.style.display = 'none';
        this.mainMenuCard.style.display = 'flex';
        
        document.body.style.overflow = 'auto'; 
        document.body.classList.add('menu-scrollable');
        
        this.mainMenuCard.style.marginTop = '0';
        document.getElementById('mainContainerWrapper').style.marginTop = '0';
        
        this.pageTitle.textContent = 'เมนู Studio'; 
        document.getElementById('menuTitle').textContent = 'เมนู Studio'; 
        document.getElementById('mainMenuCard').querySelector('p').textContent = 'เลือก Studio ที่ต้องการเข้าถึง';

        this.fetchStudioNamesAndSetupMenu();
    }

    showGeofenceChecker() {
        document.body.classList.add('light-mode'); 
        document.body.classList.remove('dark-mode'); 
        document.body.style.backgroundColor = '#f8fafc'; 
        
        this.mainContainerWrapper.style.display = 'flex'; 
        this.mainMenuCard.style.display = 'none';
        this.geofenceChecker.style.display = 'flex';
        this.pageTitle.textContent = `ตรวจสอบ: ${this.studioName}`;

        document.body.style.overflow = 'hidden'; 
        document.body.classList.remove('menu-scrollable');
        this.mainMenuCard.style.marginTop = '';
        document.getElementById('mainContainerWrapper').style.marginTop = '';
    }
    
    // --- NEW: API Fetchers ---
    
    // 🚨 MODIFIED: ใช้ fetch API เพื่อดึงรายการปุ่มจาก Apps Script API
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
                this.menuButtonsContainer.innerHTML = '<p style="color:#ef4444; text-align: center;">ไม่สามารถโหลดรายการ Studio ได้ (โปรดตรวจสอบ API Backend)</p>';
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
                const url = `?studio=${encodeURIComponent(name)}`;
                window.open(window.location.origin + window.location.pathname + url, '_blank'); 
            });
            
            this.menuButtonsContainer.appendChild(newButton);
        });
    }

    // 🚨 MODIFIED: ใช้ fetch API เพื่อดึง Announcement Config จาก Apps Script API
    async loadAnnouncement(action, isInitialLoad = false, control = null) {
        
        if (control) {
             this.announcementControl = control;
        }

        if (!this.announcementModalOverlay) {
             this.startCloseButtonControl(action);
             return;
        }
        
        this.isAnnouncementActive = true; 
        this.closeAnnouncementButton.style.display = 'none'; 
        this.countdownText.style.display = 'none'; 
        this.closeIcon.style.display = 'none';
        
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        
        if (!isInitialLoad) {
            this.announcementModalOverlay.classList.remove('show', 'initial-show');
            this.announcementModalOverlay.style.display = 'none';
        }
        
        this.announcementImage.style.display = 'none';
        this.announcementActionArea.style.display = 'none'; 

        this.announcementModalOverlay.setAttribute('data-post-action', action);
        this.announcementActionButton.removeEventListener('click', this._onAnnouncementButtonClick);
        
        if (isInitialLoad) {
            this.announcementModalOverlay.style.display = 'flex'; 
            this.modalLoader.style.display = 'flex';
            this.announcementModalOverlay.classList.add('show', 'initial-show');
        } else {
            this.announcementModalOverlay.style.display = 'flex'; 
            this.modalLoader.style.display = 'flex';
            setTimeout(() => {
                 this.announcementModalOverlay.classList.add('show');
            }, 50);
        }

        try {
            const formData = new FormData();
            formData.append('action', 'get_announcement_image');
            // ⚠️ ไม่ต้องส่ง sheetUrl แล้ว เพราะ API (Code.gs) ทราบเอง
            
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
                    this.startCloseButtonControl(action); 
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
                    if (isImageLoading) { 
                        console.warn("Announcement load timeout. Skipping image and calling control flow.");
                        this.announcementImage.src = ''; 
                        this.modalLoader.style.display = 'none';
                        this.startCloseButtonControl(action);
                    }
                }, 5000); 
                
            } else {
                this.isAnnouncementActive = false; 
                this.closeAnnouncementModal();
            }
        } catch (error) {
            console.error('Error fetching announcement:', error);
            this.isAnnouncementActive = false; 
            this.closeAnnouncementModal();
        }
    }
    
    startCloseButtonControl(action) {
        if (!this.announcementModalOverlay || !this.isAnnouncementActive) {
             if (action === 'geofence_check') { this.showGeofenceChecker(); this.checkGeolocation(); } 
             else if (action === 'bypass_redirect') { window.open(this.bypassUrl, '_self'); } 
             else { this.continueAppFlow(); }
             return;
        }
        
        this.announcementModalOverlay.setAttribute('data-post-action', action);
        
        if (this.announcementControl.hideCloseBtn) {
            this.closeAnnouncementButton.style.display = 'none';
            this.countdownText.style.display = 'none';
            this.closeIcon.style.display = 'none';
            
        } else if (this.announcementControl.countdownSec > 0) {
            let remaining = this.announcementControl.countdownSec;
            
            this.closeAnnouncementButton.style.display = 'flex'; 
            this.closeIcon.style.display = 'none'; 
            this.countdownText.style.display = 'block'; 

            this.countdownInterval = setInterval(() => {
                this.countdownText.textContent = remaining; 
                remaining--;

                if (remaining < 0) {
                    clearInterval(this.countdownInterval);
                    this.countdownInterval = null;
                    
                    this.countdownText.style.display = 'none'; 
                    this.closeIcon.style.display = 'block'; 
                }
            }, 1000);
            
        } else {
            this.closeAnnouncementButton.style.display = 'flex'; 
            this.closeIcon.style.display = 'block';
            this.countdownText.style.display = 'none';
        }
    }


    closeAnnouncementModal() {
        this.announcementModalOverlay.classList.remove('show', 'initial-show');
        this.announcementActionButton.removeEventListener('click', this._onAnnouncementButtonClick);
        
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        this.isAnnouncementActive = false;
        
        const postAction = this.announcementModalOverlay.getAttribute('data-post-action');
        
        setTimeout(() => {
            this.announcementModalOverlay.style.display = 'none';
            this.countdownText.style.display = 'none'; 
            
            if (postAction === 'bypass_redirect' && this.bypassUrl) {
                window.open(this.bypassUrl, '_self'); 
            } else if (postAction === 'geofence_check') {
                this.showGeofenceChecker();
                this.checkGeolocation();
            } else if (postAction === 'main_menu') {
                 this.continueAppFlow();
            }
        }, 300); 
    }

    // --- Geofencing Logic ---

    // 🚨 MODIFIED: ใช้ fetch API เพื่อดึง Geofence Config จาก Apps Script API
    async fetchGeofenceConfig(isPreload = false) {
        if (!this.studioName) {
            this.continueAppFlow(); 
            return null;
        }
        
        if (!isPreload) {
             this.showGeofenceChecker(); 
             this.updateStatus('loading', `กำลังโหลดข้อมูล ${this.studioName}...`, 'กำลังติดต่อเซิร์ฟเวอร์เพื่อดึงพิกัดที่ถูกต้อง');
        }

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
                if (isPreload) {
                   return result; 
                }
                
                // --- โหมดการประมวลผลหลัง Preload (ถ้าไม่ Preload จะรันต่อที่นี่) ---
                this.announcementControl = result.announcementControl || { hideCloseBtn: false, countdownSec: 0 };
                
                if (result.needsCheck === false) {
                    this.geofenceChecker.style.display = 'none'; 
                    this.isBypassMode = true; 
                    this.bypassUrl = result.formUrl;
                    
                    // ประกาศรอบที่ 2 (Bypass Mode) -> Redirect 
                    this.loadAnnouncement('bypass_redirect', false, this.announcementControl); 
                    return result; 
                }
                
                // Geofence Check Required
                this.target.lat = result.targetLat;
                this.target.lon = result.targetLon;
                this.target.dist = result.maxDist;
                this.target.url = result.formUrl;
                
                // เริ่มเช็คพิกัด
                this.checkGeolocation(); 
                return result;
                
            } else {
                if (!isPreload) {
                   this.updateStatus('error', 'เกิดข้อผิดพลาด', result.message || 'ไม่สามารถดึงข้อมูลพิกัดจากเซิร์ฟเวอร์');
                }
                // 🚨 FIXED: หากโหลด Config ล้มเหลวใน Child Page ให้ Redirect กลับไป Admin Page 
                if (this.studioName) {
                    window.location.href = window.location.origin + window.location.pathname; 
                }
                return null;
            }
        } catch (error) {
            if (!isPreload) {
                this.updateStatus('error', 'การเชื่อมต่อล้มเหลว', 'ไม่สามารถเชื่อมต่อกับ Web App ได้');
            }
            // 🚨 FIXED: หากเชื่อมต่อล้มเหลวใน Child Page ให้ Redirect กลับไป Admin Page 
            if (this.studioName) {
                window.location.href = window.location.origin + window.location.pathname; 
            }
            return null;
        }
    }

    checkGeolocation() {
        if (this.target.lat === null) {
             this.fetchGeofenceConfig(false); 
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
