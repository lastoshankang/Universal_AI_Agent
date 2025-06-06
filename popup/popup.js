// ─────────────────────────────────────────────────────────────────────────────
// Universal AI Assistant - 통합 팝업 JavaScript
// ─────────────────────────────────────────────────────────────────────────────

class UniversalAIAssistant {
    constructor() {
        // 기본 설정
        this.extensionEnabled = true;
        this.currentTabId = null;
        this.currentService = null;
        this.conversationData = null;
        this.scannedAITabs = [];
        
        // AI 서비스 설정
        this.aiSites = {
            chatgpt: { 
                name: 'ChatGPT', 
                url: 'https://chat.openai.com', 
                isConnected: false,
                emoji: '🤖',
                color: 'service-chatgpt'
            },
            claude: { 
                name: 'Claude', 
                url: 'https://claude.ai', 
                isConnected: false,
                emoji: '🧠',
                color: 'service-claude'
            },
            gemini: { 
                name: 'Gemini', 
                url: 'https://gemini.google.com', 
                isConnected: false,
                emoji: '💎',
                color: 'service-gemini'
            },
            perplexity: { 
                name: 'Perplexity', 
                url: 'https://www.perplexity.ai', 
                isConnected: false,
                emoji: '🔍',
                color: 'service-perplexity'
            },
            grok: { 
                name: 'Grok', 
                url: 'https://grok.com', 
                isConnected: false,
                emoji: '🚀',
                color: 'service-grok'
            }
        };
        
        // DOM 요소 캐시
        this.elements = {};
        
        this.init();
    }

    async init() {
        this.cacheElements();
        this.bindEvents();
        await this.loadSettings();
        await this.checkCurrentTab();
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // DOM 요소 캐시 및 이벤트 바인딩
    // ─────────────────────────────────────────────────────────────────────────────

    cacheElements() {
        this.elements = {
            // 공통 요소
            extensionToggle: document.getElementById('extensionToggle'),
            settingsBtn: document.getElementById('settingsBtn'),
            disabledOverlay: document.getElementById('disabledOverlay'),
            mainContent: document.getElementById('mainContent'),
            
            // 상태 표시
            statusMessage: document.getElementById('statusMessage'),
            serviceIndicator: document.getElementById('serviceIndicator'),
            
            // 탭 네비게이션
            chatTab: document.getElementById('chatTab'),
            exportTab: document.getElementById('exportTab'),
            chatPanel: document.getElementById('chatPanel'),
            exportPanel: document.getElementById('exportPanel'),
            
            // 채팅 패널
            openAllBtn: document.getElementById('openAllBtn'),
            clearResultsBtn: document.getElementById('clearResultsBtn'),
            messageInput: document.getElementById('messageInput'),
            sendBtn: document.getElementById('sendBtn'),
            results: document.getElementById('results'),
            
            // 내보내기 패널
            conversationInfo: document.getElementById('conversationInfo'),
            serviceName: document.getElementById('serviceName'),
            chatTitle: document.getElementById('chatTitle'),
            messageCount: document.getElementById('messageCount'),
            lastUpdate: document.getElementById('lastUpdate'),
            
            includeUserMessages: document.getElementById('includeUserMessages'),
            includeAssistantMessages: document.getElementById('includeAssistantMessages'),
            includeTimestamp: document.getElementById('includeTimestamp'),
            
            exportCurrentBtn: document.getElementById('exportCurrentBtn'),
            scanAllTabsBtn: document.getElementById('scanAllTabsBtn'),
            batchExportBtn: document.getElementById('batchExportBtn'),
            
            tabScanInfo: document.getElementById('tabScanInfo'),
            tabList: document.getElementById('tabList'),
            batchProgress: document.getElementById('batchProgress'),
            progressList: document.getElementById('progressList'),
            
            // 모달
            modal: document.getElementById('modal'),
            modalBody: document.getElementById('modalBody'),
            closeModal: document.querySelector('.close'),
            
            // 도움말 링크
            helpLink: document.getElementById('helpLink'),
            aboutLink: document.getElementById('aboutLink')
        };
    }

    bindEvents() {
        // 확장 프로그램 토글
        this.elements.extensionToggle.addEventListener('change', (e) => {
            this.toggleExtension(e.target.checked);
        });

        // 설정 버튼
        this.elements.settingsBtn.addEventListener('click', () => {
            chrome.runtime.openOptionsPage();
        });

        // 탭 네비게이션
        this.elements.chatTab.addEventListener('click', () => this.switchTab('chat'));
        this.elements.exportTab.addEventListener('click', () => this.switchTab('export'));

        // 채팅 패널 이벤트
        this.elements.sendBtn.addEventListener('click', () => this.sendToAllAI());
        this.elements.messageInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') this.sendToAllAI();
        });
        
        this.elements.openAllBtn.addEventListener('click', () => this.openAllAISites());
        this.elements.clearResultsBtn.addEventListener('click', () => this.clearResults());

        // AI 서비스 테스트 버튼
        document.querySelectorAll('.test-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const aiType = e.target.dataset.ai;
                this.testConnection(aiType);
            });
        });

        // AI 서비스 활성화 체크박스
        document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            if (checkbox.id !== 'extensionToggle' && 
                !checkbox.id.includes('include')) {
                checkbox.addEventListener('change', () => this.saveSettings());
            }
        });

        // 내보내기 패널 이벤트
        this.elements.exportCurrentBtn.addEventListener('click', () => this.exportCurrentTab());
        this.elements.scanAllTabsBtn.addEventListener('click', () => this.scanAllTabs());
        this.elements.batchExportBtn.addEventListener('click', () => this.batchExportAllTabs());

        // 모달 이벤트
        this.elements.closeModal.addEventListener('click', () => this.closeModal());
        this.elements.modal.addEventListener('click', (e) => {
            if (e.target.id === 'modal') this.closeModal();
        });

        // 도움말 링크
        this.elements.helpLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.showHelp();
        });
        this.elements.aboutLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.showAbout();
        });

        // 키보드 단축키
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'T') {
                e.preventDefault();
                this.toggleExtension();
            }
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 확장 프로그램 상태 관리
    // ─────────────────────────────────────────────────────────────────────────────

    async toggleExtension(enabled = null) {
        if (enabled === null) {
            this.extensionEnabled = !this.extensionEnabled;
        } else {
            this.extensionEnabled = enabled;
        }

        this.updateExtensionUI();
        await this.saveExtensionState();
        
        // 백그라운드에 상태 변경 알림
        try {
            await chrome.runtime.sendMessage({
                action: 'extensionToggled',
                enabled: this.extensionEnabled
            });
        } catch (error) {
            this.debugLog('popup', 'Failed to notify background about extension toggle:', error);
        }

        this.debugLog('popup', `확장 프로그램 ${this.extensionEnabled ? '활성화' : '비활성화'}`);
    }

    updateExtensionUI() {
        this.elements.extensionToggle.checked = this.extensionEnabled;
        
        if (this.extensionEnabled) {
            document.querySelector('.container').classList.remove('disabled');
            this.elements.disabledOverlay.style.display = 'none';
        } else {
            document.querySelector('.container').classList.add('disabled');
            this.elements.disabledOverlay.style.display = 'flex';
        }
    }

    async saveExtensionState() {
        try {
            const result = await chrome.storage.local.get(['settings']);
            const settings = result.settings || {};
            settings.extensionEnabled = this.extensionEnabled;
            await chrome.storage.local.set({ settings: settings });
        } catch (error) {
            this.debugLog('popup', '확장 프로그램 상태 저장 실패:', error);
        }
    }

    async loadExtensionState() {
        try {
            const result = await chrome.storage.local.get(['settings']);
            if (result.settings && typeof result.settings.extensionEnabled === 'boolean') {
                this.extensionEnabled = result.settings.extensionEnabled;
            }
            this.updateExtensionUI();
        } catch (error) {
            this.debugLog('popup', '확장 프로그램 상태 로드 실패:', error);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 탭 네비게이션
    // ─────────────────────────────────────────────────────────────────────────────

    switchTab(tabName) {
        // 탭 버튼 활성화 상태 변경
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(panel => panel.classList.remove('active'));

        if (tabName === 'chat') {
            this.elements.chatTab.classList.add('active');
            this.elements.chatPanel.classList.add('active');
        } else if (tabName === 'export') {
            this.elements.exportTab.classList.add('active');
            this.elements.exportPanel.classList.add('active');
            // 내보내기 탭으로 전환할 때 현재 페이지 상태 다시 확인
            this.checkCurrentTabForExport();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 현재 탭 상태 확인
    // ─────────────────────────────────────────────────────────────────────────────

    async checkCurrentTab() {
        try {
            this.elements.statusMessage.className = 'status-message loading';
            this.elements.statusMessage.textContent = '페이지 상태 확인 중...';
            this.elements.serviceIndicator.style.display = 'none';

            // 현재 활성 탭 가져오기
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            this.currentTabId = tab.id;

            // 지원하는 AI 서비스인지 확인
            const detectedService = this.detectServiceFromUrl(tab.url);

            if (!detectedService) {
                this.elements.statusMessage.className = 'status-message not-supported';
                this.elements.statusMessage.textContent = '❌ 지원되지 않는 사이트입니다';
                return;
            }

            this.currentService = detectedService;
            const config = this.aiSites[this.currentService];

            // 서비스 인디케이터 표시
            this.elements.serviceIndicator.innerHTML = `${config.emoji} ${config.name}`;
            this.elements.serviceIndicator.className = `service-indicator ${config.color}`;
            this.elements.serviceIndicator.style.display = 'inline-flex';

            this.elements.statusMessage.className = 'status-message supported';
            this.elements.statusMessage.textContent = `✅ ${config.name} 페이지 감지됨`;

            // 연결 상태 확인 (채팅 기능용)
            this.checkAllConnections();

        } catch (error) {
            this.debugLog('popup', '탭 상태 확인 오류:', error);
            this.elements.statusMessage.className = 'status-message not-supported';
            this.elements.statusMessage.textContent = `❌ 오류: ${error.message}`;
        }
    }

    async checkCurrentTabForExport() {
        if (!this.currentService) return;

        try {
            // 대화 데이터 확인
            let attempts = 0;
            const maxAttempts = 5;
            let response = null;

            while (attempts < maxAttempts) {
                try {
                    response = await chrome.tabs.sendMessage(this.currentTabId, {
                        action: 'getConversationData'
                    });

                    if (response && response.success) {
                        break;
                    }
                } catch (error) {
                    this.debugLog('popup', `대화 데이터 확인 시도 ${attempts + 1} 실패:`, error.message);
                }

                attempts++;
                if (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            if (response && response.success) {
                this.conversationData = response.data;
                this.updateConversationInfo(this.conversationData);
                this.elements.conversationInfo.style.display = 'block';
                this.elements.exportCurrentBtn.disabled = false;
            } else {
                this.elements.conversationInfo.style.display = 'none';
                this.elements.exportCurrentBtn.disabled = true;
            }

        } catch (error) {
            this.debugLog('popup', '내보내기용 탭 확인 오류:', error);
            this.elements.conversationInfo.style.display = 'none';
            this.elements.exportCurrentBtn.disabled = true;
        }
    }

    detectServiceFromUrl(url) {
        if (!url) return null;

        const hostname = new URL(url).hostname.toLowerCase();
        const pathname = new URL(url).pathname.toLowerCase();

        if (hostname.includes('chat.openai.com') || hostname.includes('chatgpt.com')) {
            return 'chatgpt';
        } else if (hostname.includes('claude.ai')) {
            return 'claude';
        } else if (hostname.includes('gemini.google.com')) {
            return 'gemini';
        } else if (hostname.includes('perplexity.ai')) {
            return 'perplexity';
        } else if (hostname.includes('grok.com')) {
            return 'grok';
        } else if ((hostname.includes('x.com') || hostname.includes('twitter.com'))) {
            return pathname.includes('grok') ? 'grok' : null;
        }

        return null;
    }

    updateConversationInfo(data) {
        this.elements.serviceName.textContent = data.serviceName || this.currentService;
        this.elements.chatTitle.textContent = data.title || '제목 없음';
        this.elements.messageCount.textContent = 
            `사용자: ${data.userMessages}, AI: ${data.assistantMessages}`;
        this.elements.lastUpdate.textContent = 
            new Date().toLocaleString('ko-KR');
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 채팅 기능 (멀티챗)
    // ─────────────────────────────────────────────────────────────────────────────

    async checkAllConnections() {
        if (!this.extensionEnabled) return;
        
        const promises = Object.keys(this.aiSites).map(aiType => this.checkConnection(aiType));
        await Promise.all(promises);
    }

    async checkConnection(aiType) {
        if (!this.extensionEnabled) return;

        const statusElement = document.getElementById(`${aiType}-status`);
        if (!statusElement) return;

        statusElement.className = 'status-indicator checking';
        
        try {
            const siteInfo = this.aiSites[aiType];
            const urlPatterns = this.getUrlPatternsForService(aiType);
            
            let tabs = [];
            for (const pattern of urlPatterns) {
                const t = await chrome.tabs.query({ url: pattern });
                tabs.push(...t);
            }

            if (tabs.length > 0) {
                const response = await chrome.tabs.sendMessage(tabs[0].id, { 
                    action: 'checkConnection', 
                    aiType 
                });
                
                if (response && response.connected) {
                    this.aiSites[aiType].isConnected = true;
                    statusElement.className = 'status-indicator connected';
                } else {
                    this.aiSites[aiType].isConnected = false;
                    statusElement.className = 'status-indicator';
                }
            } else {
                this.aiSites[aiType].isConnected = false;
                statusElement.className = 'status-indicator';
            }
        } catch (error) {
            this.debugLog('popup', `${aiType} 연결 확인 실패:`, error);
            this.aiSites[aiType].isConnected = false;
            statusElement.className = 'status-indicator';
        }
    }

    getUrlPatternsForService(aiType) {
        const patterns = {
            chatgpt: ['https://chat.openai.com/*', 'https://chatgpt.com/*'],
            claude: ['https://claude.ai/*'],
            gemini: ['https://gemini.google.com/*'],
            perplexity: ['https://www.perplexity.ai/*', 'https://perplexity.ai/*'],
            grok: ['https://grok.com/*', 'https://x.com/*', 'https://twitter.com/*']
        };
        return patterns[aiType] || [];
    }

    async testConnection(aiType) {
        if (!this.extensionEnabled) {
            this.showModal('알림', '확장 프로그램이 비활성화되어 있습니다.');
            return;
        }

        const testBtn = document.querySelector(`.test-btn[data-ai="${aiType}"]`);
        const originalText = testBtn.textContent;
        testBtn.textContent = '테스트 중...';
        testBtn.disabled = true;

        try {
            const urlPatterns = this.getUrlPatternsForService(aiType);
            let tabs = [];
            
            for (const pattern of urlPatterns) {
                const t = await chrome.tabs.query({ url: pattern });
                tabs.push(...t);
            }

            if (tabs.length === 0) {
                this.addResult(aiType, 'error', '사이트가 열려있지 않습니다. 먼저 사이트를 열어주세요.');
                return;
            }

            const response = await chrome.tabs.sendMessage(tabs[0].id, { 
                action: 'testConnection', 
                aiType 
            });

            if (response && response.success) {
                this.addResult(aiType, 'success', `${this.aiSites[aiType].name} 연결 테스트 성공!`);
                await this.checkConnection(aiType);
            } else {
                this.addResult(aiType, 'error', 
                    `${this.aiSites[aiType].name} 연결 테스트 실패: ${response?.error || '알 수 없는 오류'}`);
            }
        } catch (error) {
            this.addResult(aiType, 'error', 
                `${this.aiSites[aiType].name} 테스트 중 오류: ${error.message}`);
        } finally {
            testBtn.textContent = originalText;
            testBtn.disabled = false;
        }
    }

    async sendToAllAI() {
        if (!this.extensionEnabled) {
            this.showModal('알림', '확장 프로그램이 비활성화되어 있습니다.');
            return;
        }

        const message = this.elements.messageInput.value.trim();
        if (!message) {
            this.showModal('오류', '메시지를 입력해주세요.');
            return;
        }

        const sendBtn = this.elements.sendBtn;
        const btnText = sendBtn.querySelector('.btn-text');
        const btnLoading = sendBtn.querySelector('.btn-loading');
        
        btnText.style.display = 'none';
        btnLoading.style.display = 'inline';
        sendBtn.disabled = true;

        const enabledAIs = this.getEnabledAIs();
        if (enabledAIs.length === 0) {
            this.showModal('오류', '전송할 AI를 선택해주세요.');
            this.resetSendButton();
            return;
        }

        this.clearResults();
        
        try {
            const promises = enabledAIs.map(aiType => this.sendToSingleAI(aiType, message));
            await Promise.all(promises);
            this.showModal('완료', `${enabledAIs.length}개의 AI에게 메시지 전송이 완료되었습니다.`);
        } catch (error) {
            this.debugLog('popup', '전송 중 오류:', error);
        } finally {
            this.resetSendButton();
        }
    }

    async sendToSingleAI(aiType, message) {
        this.addResult(aiType, 'sending', `${this.aiSites[aiType].name}에 전송 중...`);
        
        try {
            const urlPatterns = this.getUrlPatternsForService(aiType);
            let tabs = [];
            
            for (const pattern of urlPatterns) {
                const t = await chrome.tabs.query({ url: pattern });
                tabs.push(...t);
            }

            if (tabs.length === 0) {
                throw new Error('사이트가 열려있지 않습니다');
            }

            const response = await chrome.tabs.sendMessage(tabs[0].id, {
                action: 'sendMessage',
                message: message,
                aiType: aiType
            });

            if (response && response.success) {
                this.updateResult(aiType, 'success', `${this.aiSites[aiType].name} 전송 완료!`);
                
                // 응답 확인 (옵션)
                setTimeout(() => {
                    this.checkForResponse(tabs[0].id, aiType);
                }, 2000);
            } else {
                throw new Error(response?.error || '전송 실패');
            }
        } catch (error) {
            this.updateResult(aiType, 'error', 
                `${this.aiSites[aiType].name} 전송 실패: ${error.message}`);
        }
    }

    async checkForResponse(tabId, aiType) {
        try {
            const response = await chrome.tabs.sendMessage(tabId, {
                action: 'getResponse',
                aiType: aiType
            });
            
            if (response && response.responseText) {
                this.updateResult(aiType, 'success',
                    `${this.aiSites[aiType].name} 응답: ${response.responseText.substring(0, 100)}...`);
            }
        } catch (error) {
            this.debugLog('popup', `${aiType} 응답 확인 중 오류:`, error);
        }
    }

    getEnabledAIs() {
        const enabled = [];
        Object.keys(this.aiSites).forEach(aiType => {
            const checkbox = document.getElementById(`enable-${aiType}`);
            if (checkbox && checkbox.checked) {
                enabled.push(aiType);
            }
        });
        return enabled;
    }

    addResult(aiType, status, message) {
        const resultsContainer = this.elements.results;
        const resultItem = document.createElement('div');
        resultItem.className = `result-item ${status}`;
        resultItem.dataset.aiType = aiType;
        resultItem.innerHTML = `
            <strong>${this.aiSites[aiType].name}:</strong> ${message}
            <small style="display: block; margin-top: 4px; opacity: 0.7;">
                ${new Date().toLocaleTimeString()}
            </small>
        `;
        resultsContainer.appendChild(resultItem);
        resultsContainer.scrollTop = resultsContainer.scrollHeight;
    }

    updateResult(aiType, status, message) {
        const existingResult = document.querySelector(`[data-ai-type="${aiType}"]`);
        if (existingResult) {
            existingResult.className = `result-item ${status}`;
            existingResult.innerHTML = `
                <strong>${this.aiSites[aiType].name}:</strong> ${message}
                <small style="display: block; margin-top: 4px; opacity: 0.7;">
                    ${new Date().toLocaleTimeString()}
                </small>
            `;
        } else {
            this.addResult(aiType, status, message);
        }
    }

    clearResults() {
        this.elements.results.innerHTML = '';
    }

    resetSendButton() {
        const sendBtn = this.elements.sendBtn;
        const btnText = sendBtn.querySelector('.btn-text');
        const btnLoading = sendBtn.querySelector('.btn-loading');
        
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
        sendBtn.disabled = false;
    }

    async openAllAISites() {
        if (!this.extensionEnabled) {
            this.showModal('알림', '확장 프로그램이 비활성화되어 있습니다.');
            return;
        }

        let openedCount = 0;
        for (const [aiType, site] of Object.entries(this.aiSites)) {
            try {
                await chrome.tabs.create({ url: site.url, active: false });
                openedCount++;
            } catch (error) {
                this.debugLog('popup', `${site.name} 열기 실패:`, error);
            }
        }
        
        this.showModal('완료', `${openedCount}개의 AI 사이트가 새 탭에서 열렸습니다.`);
        
        setTimeout(() => {
            this.checkAllConnections();
        }, 3000);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 내보내기 기능
    // ─────────────────────────────────────────────────────────────────────────────

    async exportCurrentTab() {
        if (!this.currentService || !this.conversationData) {
            this.showModal('오류', '내보낼 대화가 없습니다. 지원되는 AI 사이트에서 실행해주세요.');
            return;
        }

        try {
            this.elements.exportCurrentBtn.disabled = true;
            this.elements.exportCurrentBtn.textContent = '📝 내보내는 중...';

            const options = {
                includeUserMessages: this.elements.includeUserMessages.checked,
                includeAssistantMessages: this.elements.includeAssistantMessages.checked,
                includeTimestamp: this.elements.includeTimestamp.checked
            };

            const response = await chrome.tabs.sendMessage(this.currentTabId, {
                action: 'exportToMarkdown',
                options: options
            });

            if (response && response.success) {
                await this.downloadMarkdownFile(response.markdown, this.conversationData.title);
                this.showModal('성공', '✅ 마크다운 파일이 다운로드되었습니다!');
            } else {
                throw new Error(response?.error || '마크다운 생성에 실패했습니다');
            }

        } catch (error) {
            this.debugLog('popup', '내보내기 오류:', error);
            this.showModal('오류', `❌ 내보내기 실패: ${error.message}`);
        } finally {
            this.elements.exportCurrentBtn.disabled = false;
            this.elements.exportCurrentBtn.textContent = '📝 현재 페이지 내보내기';
        }
    }

    async scanAllTabs() {
        try {
            this.elements.scanAllTabsBtn.disabled = true;
            this.elements.scanAllTabsBtn.textContent = '🔍 탭 스캔 중...';

            const allTabs = await chrome.tabs.query({ currentWindow: true });
            this.scannedAITabs = [];

            for (const tab of allTabs) {
                const service = this.detectServiceFromUrl(tab.url);
                if (service && this.aiSites[service]) {
                    const config = this.aiSites[service];
                    this.scannedAITabs.push({
                        id: tab.id,
                        title: tab.title,
                        url: tab.url,
                        service: service,
                        serviceName: config.name,
                        emoji: config.emoji,
                        status: 'detected'
                    });
                }
            }

            this.updateTabScanDisplay();

            if (this.scannedAITabs.length > 0) {
                this.elements.batchExportBtn.disabled = false;
                this.showModal('성공', `✅ ${this.scannedAITabs.length}개의 AI 서비스 탭을 발견했습니다!`);
            } else {
                this.showModal('알림', '❌ AI 서비스 탭을 찾을 수 없습니다.');
            }

        } catch (error) {
            this.debugLog('popup', '탭 스캔 오류:', error);
            this.showModal('오류', `❌ 탭 스캔 실패: ${error.message}`);
        } finally {
            this.elements.scanAllTabsBtn.disabled = false;
            this.elements.scanAllTabsBtn.textContent = '🔍 모든 탭 스캔하기';
        }
    }

    updateTabScanDisplay() {
        if (this.scannedAITabs.length === 0) {
            this.elements.tabScanInfo.style.display = 'none';
            return;
        }

        this.elements.tabScanInfo.style.display = 'block';
        this.elements.tabList.innerHTML = '';

        this.scannedAITabs.forEach(tab => {
            const tabItem = document.createElement('div');
            tabItem.className = 'tab-item';

            const truncatedTitle = tab.title.length > 30 ? 
                tab.title.substring(0, 30) + '...' : tab.title;

            tabItem.innerHTML = `
                <div class="tab-service">
                    <span>${tab.emoji}</span>
                    <span style="font-weight: 600;">${tab.serviceName}</span>
                </div>
                <div class="tab-title">${truncatedTitle}</div>
            `;

            this.elements.tabList.appendChild(tabItem);
        });
    }

    async batchExportAllTabs() {
        if (this.scannedAITabs.length === 0) {
            this.showModal('오류', '❌ 먼저 탭 스캔을 실행해주세요.');
            return;
        }

        try {
            this.elements.batchExportBtn.disabled = true;
            this.elements.batchExportBtn.textContent = '📥 일괄 다운로드 중...';

            this.elements.batchProgress.style.display = 'block';
            this.elements.progressList.innerHTML = '';

            const options = {
                includeUserMessages: this.elements.includeUserMessages.checked,
                includeAssistantMessages: this.elements.includeAssistantMessages.checked,
                includeTimestamp: this.elements.includeTimestamp.checked
            };

            let successCount = 0;
            let failCount = 0;

            for (const tab of this.scannedAITabs) {
                const progressItem = this.addProgressItem(tab);

                try {
                    this.updateProgressItem(progressItem, 'processing', '처리 중...');

                    const conversationResponse = await chrome.tabs.sendMessage(tab.id, {
                        action: 'getConversationData'
                    });

                    if (!conversationResponse || !conversationResponse.success) {
                        throw new Error('대화 데이터를 가져올 수 없습니다');
                    }

                    const markdownResponse = await chrome.tabs.sendMessage(tab.id, {
                        action: 'exportToMarkdown',
                        options: options
                    });

                    if (!markdownResponse || !markdownResponse.success) {
                        throw new Error('마크다운 생성에 실패했습니다');
                    }

                    await this.downloadMarkdownFile(
                        markdownResponse.markdown, 
                        conversationResponse.data?.title || 'conversation',
                        tab.serviceName
                    );

                    this.updateProgressItem(progressItem, 'success', '완료');
                    successCount++;

                } catch (error) {
                    this.debugLog('popup', `탭 ${tab.id} 처리 오류:`, error);
                    this.updateProgressItem(progressItem, 'error', error.message);
                    failCount++;
                }

                await new Promise(resolve => setTimeout(resolve, 500));
            }

            if (successCount > 0) {
                this.showModal('성공', 
                    `✅ ${successCount}개 파일 다운로드 완료! ${failCount > 0 ? `(${failCount}개 실패)` : ''}`);
            } else {
                this.showModal('오류', '❌ 모든 파일 다운로드에 실패했습니다.');
            }

        } catch (error) {
            this.debugLog('popup', '일괄 내보내기 오류:', error);
            this.showModal('오류', `❌ 일괄 내보내기 실패: ${error.message}`);
        } finally {
            this.elements.batchExportBtn.disabled = false;
            this.elements.batchExportBtn.textContent = '📥 모든 탭 자동저장';
        }
    }

    addProgressItem(tab) {
        const progressItem = document.createElement('div');
        progressItem.className = 'progress-item';

        const truncatedTitle = tab.title.length > 25 ? 
            tab.title.substring(0, 25) + '...' : tab.title;

        progressItem.innerHTML = `
            <div>
                <span>${tab.emoji}</span>
                <span style="font-weight: 600;">${tab.serviceName}</span>
                <span style="color: #6c757d; margin-left: 5px;">${truncatedTitle}</span>
            </div>
            <div class="progress-status processing">대기중</div>
        `;

        this.elements.progressList.appendChild(progressItem);
        return progressItem;
    }

    updateProgressItem(progressItem, status, message) {
        const statusEl = progressItem.querySelector('.progress-status');
        statusEl.className = `progress-status ${status}`;
        statusEl.textContent = message;
    }

    async downloadMarkdownFile(markdown, title, serviceName = null) {
        const timestamp = new Date().toISOString()
            .slice(0, 19)
            .replace(/[:-]/g, '')
            .replace('T', '_');

        const servicePrefix = serviceName ? `${serviceName.toLowerCase()}_` : '';
        const filename = `${servicePrefix}${title}_${timestamp}.md`
            .replace(/[<>:"/\\|?*]/g, '_')
            .replace(/\s+/g, '_');

        const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        await chrome.downloads.download({
            url: url,
            filename: filename,
            saveAs: false
        });

        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 설정 관리
    // ─────────────────────────────────────────────────────────────────────────────

    async saveSettings() {
        const settings = { 
            extensionEnabled: this.extensionEnabled,
            enabledAIs: {} 
        };
        
        Object.keys(this.aiSites).forEach(aiType => {
            const checkbox = document.getElementById(`enable-${aiType}`);
            settings.enabledAIs[aiType] = checkbox ? checkbox.checked : true;
        });
        
        try {
            await chrome.storage.local.set({ settings: settings });
        } catch (error) {
            this.debugLog('popup', '설정 저장 실패:', error);
        }
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.local.get(['settings']);
            
            if (result.settings) {
                // 확장 프로그램 활성화 상태 로드
                if (typeof result.settings.extensionEnabled === 'boolean') {
                    this.extensionEnabled = result.settings.extensionEnabled;
                }
                
                // AI 활성화 상태 로드
                if (result.settings.enabledAIs) {
                    Object.keys(this.aiSites).forEach(aiType => {
                        const checkbox = document.getElementById(`enable-${aiType}`);
                        if (checkbox && typeof result.settings.enabledAIs[aiType] === 'boolean') {
                            checkbox.checked = result.settings.enabledAIs[aiType];
                        }
                    });
                }
            }
            
            this.updateExtensionUI();
        } catch (error) {
            this.debugLog('popup', '설정 로드 실패:', error);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 모달 및 도움말
    // ─────────────────────────────────────────────────────────────────────────────

    showModal(title, content) {
        this.elements.modalBody.innerHTML = `
            <h3>${title}</h3>
            <p style="margin-top: 10px;">${content}</p>
        `;
        this.elements.modal.style.display = 'block';
    }

    closeModal() {
        this.elements.modal.style.display = 'none';
    }

    showHelp() {
        const helpContent = `
            <h3>사용법</h3>
            <div style="text-align: left; margin-top: 15px;">
                <h4>1. 확장 프로그램 활성화</h4>
                <p>• 상단 토글 스위치로 활성화/비활성화</p>
                <p>• 단축키: <kbd>Ctrl+Shift+T</kbd></p>
                
                <h4>2. 채팅 전송 기능</h4>
                <p>• 각 AI 사이트에 로그인하세요</p>
                <p>• "모든 AI 사이트 열기" 버튼으로 한 번에 열 수 있습니다</p>
                <p>• 메시지를 입력하고 전송할 AI를 선택하세요</p>
                <p>• "모든 AI에게 전송" 버튼을 클릭하세요</p>
                
                <h4>3. 대화 내보내기 기능</h4>
                <p>• AI 사이트에서 대화를 진행하세요</p>
                <p>• "대화 내보내기" 탭으로 전환하세요</p>
                <p>• 내보내기 옵션을 선택하세요</p>
                <p>• "현재 페이지 내보내기" 또는 "일괄 내보내기"를 실행하세요</p>
                
                <h4>4. 단축키</h4>
                <p>• <kbd>Ctrl+Enter</kbd>: 메시지 전송</p>
                <p>• <kbd>Ctrl+Shift+T</kbd>: 확장 프로그램 토글</p>
                <p>• <kbd>Escape</kbd>: 모달 닫기</p>
                
                <h4>5. 주의사항</h4>
                <p>• 각 AI 사이트의 이용약관을 준수하세요</p>
                <p>• 개인적/교육적 용도로만 사용하세요</p>
            </div>
        `;
        this.showModal('도움말', helpContent);
    }

    showAbout() {
        const aboutContent = `
            <h3>Universal AI Assistant</h3>
            <div style="text-align: left; margin-top: 15px;">
                <p><strong>버전:</strong> 2.0.0</p>
                <p><strong>개발:</strong> AI Assistant</p>
                <p><strong>목적:</strong> 통합 AI 도구</p>
                
                <h4>주요 기능</h4>
                <p>• 다중 AI 채팅 전송</p>
                <p>• 대화 내용 마크다운 내보내기</p>
                <p>• 일괄 처리 및 자동화</p>
                <p>• 확장 프로그램 활성화/비활성화 토글</p>
                
                <h4>지원 AI 서비스</h4>
                <p>• ChatGPT (OpenAI)</p>
                <p>• Claude (Anthropic)</p>
                <p>• Gemini (Google)</p>
                <p>• Perplexity AI</p>
                <p>• Grok (xAI)</p>
                
                <h4>통합된 기능</h4>
                <p>• Multi-AI Chat Extension (채팅 전송)</p>
                <p>• Universal AI MD Exporter (내보내기)</p>
                
                <h4>면책조항</h4>
                <p>이 확장 프로그램은 교육 목적으로 제작되었습니다. 각 AI 서비스의 이용약관을 준수하여 사용하시기 바랍니다.</p>
            </div>
        `;
        this.showModal('프로그램 정보', aboutContent);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 유틸리티 함수
    // ─────────────────────────────────────────────────────────────────────────────

    debugLog(category, message, data = null) {
        const timestamp = new Date().toISOString();
        const logMessage = `[Universal AI Assistant] [${timestamp}] [${category.toUpperCase()}] ${message}`;
        
        if (data) {
            console.log(logMessage, data);
        } else {
            console.log(logMessage);
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 초기화
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    new UniversalAIAssistant();
});