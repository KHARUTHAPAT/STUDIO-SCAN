// Geofencing and Announcement Logic (Pure Google Sheets API v4)
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
        
        // 🔴 NEW: เพิ่ม Modal Loader Text
        this.modalLoaderText = document.getElementById('modalLoaderText');
        // 🔴 REMOVED: ลบ this.textLoaderLine ออก
        
        // 🔴 NEW: Floating Footer Elements
        this.countdownFooter = document.getElementById('countdownFooter');
        this.countdownTimerText = document.getElementById('countdownTimerText');

        // NEW: Announcement Button Elements
        this.announcementActionArea = document.getElementById('announcementActionArea');
        this.announcementActionButton = document.getElementById('announcementActionButton');

        // 🔴 NEW: Admin Auth Elements
        this.adminAuthModalOverlay = document.getElementById('adminAuthModalOverlay');
        this.adminPasscodeInput = document.getElementById('adminPasscodeInput');
        this.adminAuthButton = document.getElementById('adminAuthButton');
        this.adminAuthError = document.getElementById('adminAuthError');
        
        this.ADMIN_PASSCODE = 'admin123'; 
        
        // 🔴 FIX: ตรวจสอบสถานะล็อกอิน 5 นาที (300,000 มิลลิวินาที) จาก Local Storage
        const lastAuthTime = localStorage.getItem('admin_auth_time');
        this.isAdminAuthenticated = lastAuthTime && (Date.now() - parseInt(lastAuthTime) < 300000); 
        if (!this.isAdminAuthenticated) {
            localStorage.removeItem('admin_auth_time');
        }
        this.authCountdownInterval = null; // ตัวแปรสำหรับเก็บ Interval ของ Auth Timer

        // =================================================================
        // *** 🔴 PURE SHEETS API V4 CONFIGURATION 🔴 ***
        // =================================================================
        this.API_KEY = 'AIzaSyBivFhVOiCJdpVF4xNb7vYRNJLxLj60Rk0'; 
        this.SHEET_ID = '1o8Z0bybLymUGlm7jfgpY4qHhwT9aC2mO141Xa1YlZ0Q'; 
        
        this.STUDIO_SHEET_NAME = 'Studio'; 
        this.CONFIG_SHEET_NAME = 'รวมข้อมูล'; 
        
        // 🔴 NEW: Base URL สำหรับรูปภาพประกาศ (ถ้าใช้ ibb.co)
        this.ANNOUNCEMENT_IMAGE_BASE_URL = 'https://i.ibb.co/';
        
        // 🔴 NEW: ตัวแปรสำหรับควบคุม Timeout 20 วินาที
        this.ANNOUNCEMENT_LOAD_TIMEOUT_SEC = 20; 
        this.loadTimeoutInterval = null; 

        // Geofencing Parameters
        this.params = new URLSearchParams(window.location.search);
        this.studioName = this.params.get('studio');
        
        this.studioData = {}; 
        this.geofenceConfig = {}; 
        this.announcementConfig = {}; 
        
        this.target = { lat: null, lon: null, dist: null, url: null };

        this.isBypassMode = false;
        this.bypassUrl = null; 
        
        this.announcementControl = {
            hideCloseBtn: false,
            countdownSec: 0
        };
        this.isAnnouncementActive = false;
        this.countdownInterval = null;

        this.geofenceChecker.style.display = 'none';
        this.mainMenuCard.style.display = 'none';
        this.mainContainerWrapper.style.display = 'none'; 
        
        this.pageTitle.textContent = 'ประกาศ'; 
        
        document.body.classList.add('light-mode');
        document.body.classList.remove('dark-mode'); 
        document.body.style.backgroundColor = '#f8fafc';
        
        document.body.style.overflow = 'hidden'; 

        this.init();
    }
    
    // ... (โค้ดเดิม) ...

    bindEvents() {
        this._setRetryToGeolocationCheck(); 
        
        if (this.closeAnnouncementButton) {
            this.closeAnnouncementButton.addEventListener('click', () => this.closeAnnouncementModal());
        }
        
        if (this.adminAuthButton) {
            this.adminAuthButton.addEventListener('click', () => this.checkAdminPasscode());
        }
        if (this.adminPasscodeInput) {
            this.adminPasscodeInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.checkAdminPasscode();
                }
            });
        }
        
        this.announcementImage.addEventListener('load', () => { 
             // 🔴 เมื่อโหลดสำเร็จ: เคลียร์ Timeout
             if (this.loadTimeoutInterval) {
                 clearInterval(this.loadTimeoutInterval);
                 this.loadTimeoutInterval = null;
                 if (this.modalLoaderText) this.modalLoaderText.style.display = 'none';
             }

             this.modalLoader.style.display = 'none';
             this.announcementImage.style.display = 'block';
             
             this.announcementModalOverlay.classList.remove('initial-show');
             
             const postAction = this.announcementModalOverlay.getAttribute('data-post-action');
             this.startCloseButtonControl(postAction);
        });

        this.announcementImage.addEventListener('error', () => {
             // 🔴 เมื่อโหลดล้มเหลว: เคลียร์ Timeout
             if (this.loadTimeoutInterval) {
                 clearInterval(this.loadTimeoutInterval);
                 this.loadTimeoutInterval = null;
                 if (this.modalLoaderText) this.modalLoaderText.style.display = 'none';
             }
             
             this.modalLoader.style.display = 'none';
             
             this.announcementModalOverlay.classList.remove('initial-show');
             
             this.announcementImage.style.display = 'none'; 
             
             const postAction = this.announcementModalOverlay.getAttribute('data-post-action');
             this.startCloseButtonControl(postAction);

             if (this.announcementActionArea.style.display === 'none') { 
                 this.isAnnouncementActive = false;
                 if (postAction !== 'main_menu') this.closeAnnouncementModal();
             }
             console.error("Announcement Image failed to load or permission denied.");
        });
    }

    // ... (โค้ดเดิม) ...

    // --- Announcement Logic (Pure Sheets API) ---

    // 🔴 NEW FUNCTION: จัดการการนับถอยหลังโหลด 20 วินาที (ไม่มีแถบโหลด)
    startLoadCountdown(action) {
        let remaining = this.ANNOUNCEMENT_LOAD_TIMEOUT_SEC;
        
        if (this.loadTimeoutInterval) {
             clearInterval(this.loadTimeoutInterval);
        }
        
        if (this.modalLoaderText) {
             this.modalLoaderText.style.display = 'block';
             this.modalLoaderText.style.color = '#f8fafc';
        }
        
        this.loadTimeoutInterval = setInterval(() => {
            if (this.modalLoaderText) {
                // 🔴 NEW: แสดงผล "กำลังโหลด (X)"
                this.modalLoaderText.textContent = `กำลังโหลด (${remaining})`; 
            }
            remaining--;

            if (remaining < 0) {
                clearInterval(this.loadTimeoutInterval);
                this.loadTimeoutInterval = null;
                
                // 🔴 ถ้าโหลดไม่เสร็จภายใน 20 วิ: ให้ถือว่าเสร็จสิ้นและไปต่อ 🔴
                if (this.announcementModalOverlay.classList.contains('show')) {
                     console.warn("Announcement timed out after 20s. Continuing flow.");
                     
                     // 1. ซ่อน Loader และ text
                     this.modalLoader.style.display = 'none';
                     if (this.modalLoaderText) this.modalLoaderText.style.display = 'none';

                     // 2. หากยังไม่มีภาพ (แสดงว่าโหลดไม่ทัน) ให้ไปควบคุมปุ่มปิดเลย
                     if (this.announcementImage.style.display === 'none') {
                         this.startCloseButtonControl(action);
                     }
                }
            }
        }, 1000);
    }

    // ... (โค้ดเดิม) ...

    closeAnnouncementModal() {
        this.announcementModalOverlay.classList.remove('show', 'initial-show');
        this.announcementActionButton.removeEventListener('click', this._onAnnouncementButtonClick);
        
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        // 🔴 NEW: เคลียร์ Load Timeout Interval ด้วย
        if (this.loadTimeoutInterval) {
             clearInterval(this.loadTimeoutInterval);
             this.loadTimeoutInterval = null;
        }
        if (this.modalLoaderText) this.modalLoaderText.style.display = 'none';


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
                // 🔴 FIX 4: เมื่อปิดประกาศในหน้าหลัก: ตรวจสอบ/เรียก Modal Auth 
                this.showAdminAuthModal();
            }
        }, 300); 
    }

    // ... (โค้ดเดิม) ...
}

document.addEventListener('DOMContentLoaded', () => {
    new GeofenceApp();
});
