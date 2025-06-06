// Universal AI Assistant - Options JavaScript

class UniversalAIOptionsManager {
    constructor() {
        // 기본 설정 (통합된 설정)
        this.defaultSettings = {
            // 확장 프로그램 전체 제어
            extensionEnabled: true,
            
            // AI 서비스 활성화 설정
            enabledAIs: {
                chatgpt: true,
                claude: true,
                gemini: true,
                perplexity: true,
                grok: false
            },
            
            // 메시지 전송 설정
            notifications: true,
            autoOpen: false,
            autoCollectResponses: true,
            sendDelay: 1000,
            
            // MD 내보내기 설정
            includeUserMessages: true,
            includeAssistantMessages: true,
            includeTimestamp: true,
            autoSaveMode: false,
            
            // 고급 설정
            debugMode: false,
            experimentalFeatures: false,
            autoUpdateCheck: true,
            
            // 통계 데이터
            stats: {
                totalMessages: 0,
                totalExports: 0,
                lastUsed: null,
                installDate: Date.now()
            }
        };
        
        this.currentSettings = { ...this.defaultSettings };
        this.hasUnsavedChanges = false;
        
        this.init();
    }

    async init() {
        await this.loadSettings();
        this.setupEventListeners();
        this.updateUI();
        this.loadStats();
        this.setupAutoSave();
    }

    setupEventListeners() {
        // 확장 프로그램 활성화 토글
        const extensionToggle = document.querySelector('.toggle-switch[data-option="extensionEnabled"]');
        if (extensionToggle) {
            extensionToggle.addEventListener('click', () => {
                this.toggleExtensionEnabled();
            });
        }

        // AI 서비스 토글
        document.querySelectorAll('.toggle-switch[data-ai]').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                const aiType = e.target.dataset.ai;
                this.toggleAI(aiType);
            });
        });

        // 옵션 토글
        document.querySelectorAll('.toggle-switch[data-option]').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                const option = e.target.dataset.option;
                if (option !== 'extensionEnabled') {
                    this.toggleOption(option);
                }
            });
        });

        // 전송 지연 시간 선택
        document.getElementById('sendDelay').addEventListener('change', (e) => {
            this.currentSettings.sendDelay = parseInt(e.target.value, 10);
            this.markAsChanged();
        });

        // 버튼 이벤트들
        document.getElementById('saveBtn').addEventListener('click', () => this.saveSettings());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetToDefaults());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportSettings());
        document.getElementById('importBtn').addEventListener('click', () => this.importSettings());
        document.getElementById('testBtn').addEventListener('click', () => this.testConnections());

        // 모달 관련 이벤트
        this.setupModalEvents();

        // 파일 import
        document.getElementById('importFile').addEventListener('change', (e) => {
            this.handleFileImport(e);
        });

        // 키보드 단축키
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // 링크 이벤트
        document.getElementById('helpBtn').addEventListener('click', () => this.showHelp());
        document.getElementById('aboutLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.showAbout();
        });
        document.getElementById('feedbackLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.openFeedbackForm();
        });
        document.getElementById('githubLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.openGitHub();
        });

        // 페이지 나가기 전 확인
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '저장되지 않은 변경사항이 있습니다. 정말 나가시겠습니까?';
                return e.returnValue;
            }
        });
    }

    setupModalEvents() {
        // 일반 모달
        const modal = document.getElementById('modal');
        const modalClose = modal.querySelector('.modal-close');
        const modalCloseBtn = document.getElementById('modalCloseBtn');

        modalClose.addEventListener('click', () => this.closeModal());
        modalCloseBtn.addEventListener('click', () => this.closeModal());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeModal();
        });

        // 테스트 모달
        const testModal = document.getElementById('testModal');
        const testModalClose = document.getElementById('testModalClose');
        const testModalCloseBtn = document.getElementById('testModalCloseBtn');
        const retestBtn = document.getElementById('retestBtn');

        testModalClose.addEventListener('click', () => this.closeTestModal());
        testModalCloseBtn.addEventListener('click', () => this.closeTestModal());
        retestBtn.addEventListener('click', () => this.testConnections());
        testModal.addEventListener('click', (e) => {
            if (e.target === testModal) this.closeTestModal();
        });
    }

    // ────────────────────────────────────────────────────────────────────────
    // 설정 관리
    // ────────────────────────────────────────────────────────────────────────

    async loadSettings() {
        try {
            const result = await chrome.storage.local.get(['settings']);
            if (result.settings) {
                this.currentSettings = { 
                    ...this.defaultSettings, 
                    ...result.settings,
                    // 통계는 별도로 병합
                    stats: { ...this.defaultSettings.stats, ...result.settings.stats }
                };
            }
            this.debugLog('Settings loaded:', this.currentSettings);
        } catch (error) {
            console.error('설정 로드 실패:', error);
            this.showStatus('설정 로드 중 오류가 발생했습니다.', 'error');
        }
    }

    async saveSettings() {
        try {
            const mergedSettings = { ...this.currentSettings };
            mergedSettings.stats.lastUsed = Date.now();
            
            await chrome.storage.local.set({ settings: mergedSettings });
            
            this.currentSettings = mergedSettings;
            this.hasUnsavedChanges = false;
            this.updateSaveButton();
            
            // 백그라운드에 설정 변경 알림
            try {
                await chrome.runtime.sendMessage({
                    action: 'settingsChanged',
                    settings: mergedSettings
                });
            } catch (error) {
                this.debugLog('Background message failed:', error);
            }
            
            this.showStatus('✅ 설정이 성공적으로 저장되었습니다!', 'success');
            this.debugLog('Settings saved:', mergedSettings);
        } catch (error) {
            console.error('설정 저장 실패:', error);
            this.showStatus('❌ 설정 저장 중 오류가 발생했습니다.', 'error');
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // 확장 프로그램 제어
    // ────────────────────────────────────────────────────────────────────────

    toggleExtensionEnabled() {
        this.currentSettings.extensionEnabled = !this.currentSettings.extensionEnabled;
        this.updateExtensionToggle();
        this.updateExtensionState();
        this.markAsChanged();
        
        // 즉시 저장하여 변경사항 반영
        this.saveSettings();
    }

    updateExtensionState() {
        const isEnabled = this.currentSettings.extensionEnabled;
        const mainContent = document.querySelector('.content');
        
        if (mainContent) {
            if (isEnabled) {
                mainContent.style.opacity = '1';
                mainContent.style.pointerEvents = 'auto';
                mainContent.classList.remove('disabled');
            } else {
                mainContent.style.opacity = '0.5';
                mainContent.style.pointerEvents = 'none';
                mainContent.classList.add('disabled');
            }
        }

        // 배지 업데이트
        try {
            chrome.runtime.sendMessage({
                action: 'updateBadge',
                enabled: isEnabled
            });
        } catch (error) {
            this.debugLog('Badge update failed:', error);
        }

        this.showStatus(
            isEnabled ? '✅ 확장 프로그램이 활성화되었습니다!' : '⚠️ 확장 프로그램이 비활성화되었습니다!',
            isEnabled ? 'success' : 'warning'
        );
    }

    updateExtensionToggle() {
        const toggle = document.querySelector('.toggle-switch[data-option="extensionEnabled"]');
        if (toggle) {
            this.updateToggle(toggle, this.currentSettings.extensionEnabled);
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // 설정 변경 처리
    // ────────────────────────────────────────────────────────────────────────

    toggleAI(aiType) {
        this.currentSettings.enabledAIs[aiType] = !this.currentSettings.enabledAIs[aiType];
        this.updateAICard(aiType);
        this.markAsChanged();
        this.updateStats();
    }

    toggleOption(option) {
        this.currentSettings[option] = !this.currentSettings[option];
        this.updateToggle(
            document.querySelector(`.toggle-switch[data-option="${option}"]`),
            this.currentSettings[option]
        );
        this.markAsChanged();
    }

    markAsChanged() {
        this.hasUnsavedChanges = true;
        this.updateSaveButton();
    }

    updateSaveButton() {
        const saveBtn = document.getElementById('saveBtn');
        if (this.hasUnsavedChanges) {
            saveBtn.textContent = '💾 설정 저장 *';
            saveBtn.style.background = 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)';
            saveBtn.classList.add('highlight');
        } else {
            saveBtn.textContent = '💾 설정 저장';
            saveBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            saveBtn.classList.remove('highlight');
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // UI 업데이트
    // ────────────────────────────────────────────────────────────────────────

    updateUI() {
        // 확장 프로그램 활성화 상태 초기화
        this.updateExtensionToggle();
        this.updateExtensionState();
        
        // AI 카드 상태 초기화
        Object.keys(this.currentSettings.enabledAIs).forEach(aiType => {
            this.updateAICard(aiType);
        });
        
        // 옵션 토글 초기화
        document.querySelectorAll('.toggle-switch[data-option]').forEach(toggle => {
            const option = toggle.dataset.option;
            if (option !== 'extensionEnabled') {
                this.updateToggle(toggle, this.currentSettings[option]);
            }
        });
        
        // 전송 지연 시간 설정
        const sendDelaySelect = document.getElementById('sendDelay');
        if (sendDelaySelect) {
            sendDelaySelect.value = this.currentSettings.sendDelay;
        }
        
        // 저장 버튼 상태 초기화
        this.updateSaveButton();
    }

    updateAICard(aiType) {
        const card = document.querySelector(`.ai-card[data-ai="${aiType}"]`);
        const toggle = document.querySelector(`.toggle-switch[data-ai="${aiType}"]`);
        const isEnabled = this.currentSettings.enabledAIs[aiType];
        
        if (card) {
            card.classList.toggle('enabled', isEnabled);
        }
        if (toggle) {
            this.updateToggle(toggle, isEnabled);
        }
    }

    updateToggle(toggle, isActive) {
        if (toggle) {
            toggle.classList.toggle('active', isActive);
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // 통계 관리
    // ────────────────────────────────────────────────────────────────────────

    async loadStats() {
        try {
            const stats = this.currentSettings.stats;
            
            document.getElementById('totalMessages').textContent = 
                this.formatNumber(stats.totalMessages || 0);
            document.getElementById('totalExports').textContent = 
                this.formatNumber(stats.totalExports || 0);
            document.getElementById('activeServices').textContent = 
                Object.values(this.currentSettings.enabledAIs).filter(Boolean).length;
            document.getElementById('lastUsed').textContent = 
                stats.lastUsed ? this.formatDate(stats.lastUsed) : '없음';
        } catch (error) {
            this.debugLog('Failed to load stats:', error);
        }
    }

    updateStats() {
        const activeServices = Object.values(this.currentSettings.enabledAIs).filter(Boolean).length;
        document.getElementById('activeServices').textContent = activeServices;
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return '오늘';
        } else if (diffDays === 1) {
            return '어제';
        } else if (diffDays < 7) {
            return `${diffDays}일 전`;
        } else {
            return date.toLocaleDateString('ko-KR');
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // 설정 관리 기능
    // ────────────────────────────────────────────────────────────────────────

    resetToDefaults() {
        if (confirm('모든 설정을 기본값으로 되돌리시겠습니까? 통계 데이터는 유지됩니다.')) {
            const currentStats = { ...this.currentSettings.stats };
            this.currentSettings = { 
                ...this.defaultSettings,
                stats: currentStats
            };
            this.updateUI();
            this.markAsChanged();
            this.showStatus('✅ 설정이 기본값으로 초기화되었습니다.', 'success');
        }
    }

    exportSettings() {
        try {
            const exportData = {
                version: '2.0.0',
                timestamp: Date.now(),
                settings: this.currentSettings
            };
            
            const settingsJson = JSON.stringify(exportData, null, 2);
            const blob = new Blob([settingsJson], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `universal-ai-assistant-settings-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            this.showStatus('✅ 설정이 성공적으로 내보내졌습니다.', 'success');
        } catch (error) {
            console.error('설정 내보내기 실패:', error);
            this.showStatus('❌ 설정 내보내기 중 오류가 발생했습니다.', 'error');
        }
    }

    importSettings() {
        document.getElementById('importFile').click();
    }

    handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importData = JSON.parse(e.target.result);
                
                if (this.validateImportData(importData)) {
                    // 통계 데이터는 병합
                    const currentStats = { ...this.currentSettings.stats };
                    this.currentSettings = { 
                        ...this.defaultSettings, 
                        ...importData.settings,
                        stats: { ...currentStats, ...importData.settings.stats }
                    };
                    
                    this.updateUI();
                    this.loadStats();
                    this.markAsChanged();
                    this.showStatus('✅ 설정이 성공적으로 가져와졌습니다.', 'success');
                } else {
                    this.showStatus('❌ 유효하지 않은 설정 파일입니다.', 'error');
                }
            } catch (error) {
                console.error('설정 가져오기 실패:', error);
                this.showStatus('❌ 설정 파일을 읽는 중 오류가 발생했습니다.', 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    validateImportData(importData) {
        if (!importData || typeof importData !== 'object') return false;
        if (!importData.settings || typeof importData.settings !== 'object') return false;
        
        const settings = importData.settings;
        
        // 필수 속성 검증
        if (typeof settings.extensionEnabled !== 'boolean') return false;
        if (!settings.enabledAIs || typeof settings.enabledAIs !== 'object') return false;
        
        // AI 서비스 검증
        const validAIs = ['chatgpt', 'claude', 'gemini', 'perplexity', 'grok'];
        for (const ai of validAIs) {
            if (settings.enabledAIs[ai] !== undefined && typeof settings.enabledAIs[ai] !== 'boolean') {
                return false;
            }
        }
        
        // 기타 설정 검증
        const booleanSettings = [
            'notifications', 'autoOpen', 'autoCollectResponses', 
            'includeUserMessages', 'includeAssistantMessages', 'includeTimestamp',
            'autoSaveMode', 'debugMode', 'experimentalFeatures', 'autoUpdateCheck'
        ];
        
        for (const setting of booleanSettings) {
            if (settings[setting] !== undefined && typeof settings[setting] !== 'boolean') {
                return false;
            }
        }
        
        // 숫자 설정 검증
        if (settings.sendDelay !== undefined && 
            (typeof settings.sendDelay !== 'number' || settings.sendDelay < 0)) {
            return false;
        }
        
        return true;
    }

    // ────────────────────────────────────────────────────────────────────────
    // 연결 테스트
    // ────────────────────────────────────────────────────────────────────────

    async testConnections() {
        const testModal = document.getElementById('testModal');
        const testResults = document.getElementById('testResults');
        const retestBtn = document.getElementById('retestBtn');
        
        testModal.style.display = 'block';
        testResults.innerHTML = '';
        retestBtn.disabled = true;
        retestBtn.textContent = '테스트 중...';
        
        const aiServices = {
            chatgpt: { name: 'ChatGPT', emoji: '🧠', domains: ['chatgpt.com', 'chat.openai.com'] },
            claude: { name: 'Claude', emoji: '🎭', domains: ['claude.ai'] },
            gemini: { name: 'Gemini', emoji: '💎', domains: ['gemini.google.com'] },
            perplexity: { name: 'Perplexity', emoji: '🔍', domains: ['perplexity.ai'] },
            grok: { name: 'Grok', emoji: '🌐', domains: ['grok.com', 'x.com'] }
        };
        
        for (const [aiType, info] of Object.entries(aiServices)) {
            const testItem = this.createTestItem(aiType, info);
            testResults.appendChild(testItem);
            
            try {
                this.updateTestStatus(testItem, 'testing', '테스트 중...');
                
                // 해당 AI 서비스 탭 찾기
                const tabs = await chrome.tabs.query({ 
                    url: info.domains.map(domain => `https://${domain}/*`).flat()
                });
                
                if (tabs.length === 0) {
                    this.updateTestStatus(testItem, 'error', '사이트가 열려있지 않음');
                    continue;
                }
                
                // 첫 번째 탭에서 연결 테스트
                const response = await chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'testConnection'
                });
                
                if (response && response.success) {
                    this.updateTestStatus(testItem, 'success', '연결 성공');
                } else {
                    this.updateTestStatus(testItem, 'error', response?.error || '연결 실패');
                }
                
            } catch (error) {
                this.updateTestStatus(testItem, 'error', error.message);
            }
            
            // 각 테스트 사이에 잠시 대기
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        retestBtn.disabled = false;
        retestBtn.textContent = '다시 테스트';
    }

    createTestItem(aiType, info) {
        const testItem = document.createElement('div');
        testItem.className = 'test-item';
        testItem.dataset.aiType = aiType;
        
        testItem.innerHTML = `
            <div class="test-service">
                <span>${info.emoji}</span>
                <span>${info.name}</span>
            </div>
            <div class="test-status testing">테스트 대기</div>
        `;
        
        return testItem;
    }

    updateTestStatus(testItem, status, message) {
        const statusEl = testItem.querySelector('.test-status');
        statusEl.className = `test-status ${status}`;
        statusEl.textContent = message;
    }

    // ────────────────────────────────────────────────────────────────────────
    // 모달 관리
    // ────────────────────────────────────────────────────────────────────────

    showModal(title, content) {
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
        
        modalTitle.textContent = title;
        modalBody.innerHTML = content;
        modal.style.display = 'block';
    }

    closeModal() {
        document.getElementById('modal').style.display = 'none';
    }

    closeTestModal() {
        document.getElementById('testModal').style.display = 'none';
    }

    // ────────────────────────────────────────────────────────────────────────
    // 정보 모달들
    // ────────────────────────────────────────────────────────────────────────

    showHelp() {
        const helpContent = `
            <div style="text-align: left; line-height: 1.6;">
                <h4>🚀 Universal AI Assistant 사용법</h4>
                <br>
                
                <h5>1. 확장 프로그램 제어</h5>
                <ul>
                    <li>상단의 <strong>확장 프로그램 활성화</strong> 토글로 전체 기능을 제어합니다</li>
                    <li>비활성화 시 모든 기능이 중단됩니다</li>
                    <li>단축키: <kbd>Ctrl+Shift+T</kbd></li>
                </ul>
                
                <h5>2. AI 서비스 설정</h5>
                <ul>
                    <li>각 AI 서비스를 개별적으로 활성화/비활성화할 수 있습니다</li>
                    <li>활성화된 서비스만 메시지 전송 대상이 됩니다</li>
                    <li>MD 내보내기는 모든 서비스에서 사용 가능합니다</li>
                </ul>
                
                <h5>3. 메시지 전송 기능</h5>
                <ul>
                    <li><strong>알림 표시</strong>: 전송 완료 시 브라우저 알림</li>
                    <li><strong>전송 지연</strong>: 각 AI 사이트 간 전송 간격 조절</li>
                    <li><strong>응답 수집</strong>: AI 응답을 자동으로 수집하여 표시</li>
                </ul>
                
                <h5>4. MD 내보내기 기능</h5>
                <ul>
                    <li><strong>사용자 메시지</strong>: 내 질문 포함 여부</li>
                    <li><strong>AI 응답</strong>: AI 답변 포함 여부</li>
                    <li><strong>타임스탬프</strong>: 생성 시간 및 메타데이터 포함</li>
                    <li><strong>자동 저장</strong>: 파일 위치를 묻지 않고 자동 저장</li>
                </ul>
                
                <h5>5. 키보드 단축키</h5>
                <ul>
                    <li><kbd>Ctrl+Shift+A</kbd>: 팝업 열기</li>
                    <li><kbd>Ctrl+Shift+O</kbd>: 모든 AI 사이트 열기</li>
                    <li><kbd>Ctrl+Shift+S</kbd>: 선택 텍스트 빠른 전송</li>
                    <li><kbd>Ctrl+E</kbd>: 현재 탭 MD 내보내기</li>
                </ul>
                
                <h5>6. 연결 테스트</h5>
                <ul>
                    <li><strong>연결 테스트</strong> 버튼으로 각 AI 서비스 연결 상태 확인</li>
                    <li>문제가 있는 서비스는 빨간색으로 표시됩니다</li>
                    <li>해당 사이트에 로그인이 필요할 수 있습니다</li>
                </ul>
                
                <br>
                <p style="background: #e3f2fd; padding: 15px; border-radius: 8px; border-left: 4px solid #2196f3;">
                    💡 <strong>팁:</strong> 모든 기능을 사용하기 전에 각 AI 사이트에 로그인하고 연결 테스트를 진행해보세요!
                </p>
            </div>
        `;
        this.showModal('📖 사용법 가이드', helpContent);
    }

    showAbout() {
        const aboutContent = `
            <div style="text-align: center; line-height: 1.8;">
                <h4>🤖 Universal AI Assistant</h4>
                <p style="font-size: 18px; color: #4facfe; margin: 15px 0;">v2.0.0</p>
                
                <div style="text-align: left; margin-top: 25px;">
                    <h5>📋 주요 기능</h5>
                    <ul>
                        <li><strong>Multi-Chat:</strong> 여러 AI에 동시 메시지 전송</li>
                        <li><strong>MD Export:</strong> 대화 내용을 마크다운으로 내보내기</li>
                        <li><strong>통합 관리:</strong> 하나의 확장으로 모든 기능 제공</li>
                        <li><strong>배치 처리:</strong> 여러 탭을 한 번에 처리</li>
                    </ul>
                    
                    <h5>🤖 지원 AI 서비스</h5>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 15px 0;">
                        <div>🧠 ChatGPT (OpenAI)</div>
                        <div>🎭 Claude (Anthropic)</div>
                        <div>💎 Gemini (Google)</div>
                        <div>🔍 Perplexity AI</div>
                        <div>🌐 Grok (xAI)</div>
                        <div style="grid-column: 1 / -1; text-align: center; color: #6c757d; font-size: 14px;">
                            더 많은 AI 서비스 지원 예정
                        </div>
                    </div>
                    
                    <h5>📈 업데이트 내역</h5>
                    <ul>
                        <li><strong>v2.0.0:</strong> Multi-Chat + MD Export 통합</li>
                        <li><strong>v1.3.0:</strong> 모듈화된 구조 개선</li>
                        <li><strong>v1.2.0:</strong> Grok 지원 추가</li>
                        <li><strong>v1.1.0:</strong> 배치 내보내기 기능</li>
                    </ul>
                    
                    <h5>🛡️ 개인정보 보호</h5>
                    <p style="font-size: 14px; color: #6c757d; background: #f8f9fa; padding: 15px; border-radius: 8px;">
                        이 확장 프로그램은 사용자의 대화 내용을 외부 서버로 전송하지 않습니다. 
                        모든 처리는 브라우저 내에서만 이루어지며, 데이터는 사용자의 기기에만 저장됩니다.
                    </p>
                    
                    <h5>⚖️ 라이선스</h5>
                    <p style="font-size: 14px; color: #6c757d;">
                        이 프로젝트는 교육 목적으로 제작되었습니다. 
                        각 AI 서비스의 이용약관을 준수하여 사용해주세요.
                    </p>
                </div>
            </div>
        `;
        this.showModal('ℹ️ 프로그램 정보', aboutContent);
    }

    // ────────────────────────────────────────────────────────────────────────
    // 외부 링크 처리
    // ────────────────────────────────────────────────────────────────────────

    openFeedbackForm() {
        const feedbackUrl = 'https://forms.gle/universal-ai-assistant-feedback';
        chrome.tabs.create({ url: feedbackUrl });
    }

    openGitHub() {
        const githubUrl = 'https://github.com/your-username/universal-ai-assistant';
        chrome.tabs.create({ url: githubUrl });
    }

    // ────────────────────────────────────────────────────────────────────────
    // 키보드 단축키 처리
    // ────────────────────────────────────────────────────────────────────────

    handleKeyboardShortcuts(e) {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 's':
                    if (!e.shiftKey) {
                        e.preventDefault();
                        this.saveSettings();
                    }
                    break;
                case 'r':
                    if (!e.shiftKey) {
                        e.preventDefault();
                        this.resetToDefaults();
                    }
                    break;
                case 'e':
                    if (!e.shiftKey) {
                        e.preventDefault();
                        this.exportSettings();
                    }
                    break;
                case 'i':
                    if (!e.shiftKey) {
                        e.preventDefault();
                        this.importSettings();
                    }
                    break;
                case 't':
                    if (!e.shiftKey) {
                        e.preventDefault();
                        this.testConnections();
                    }
                    break;
                case 'h':
                    e.preventDefault();
                    this.showHelp();
                    break;
            }
        }
        
        // ESC 키로 모달 닫기
        if (e.key === 'Escape') {
            this.closeModal();
            this.closeTestModal();
        }
    }

    // ────────────────────────────────────────────────────────────────────────
    // 자동 저장 및 유틸리티
    // ────────────────────────────────────────────────────────────────────────

    setupAutoSave() {
        // 5분마다 자동 저장 (변경사항이 있는 경우)
        setInterval(() => {
            if (this.hasUnsavedChanges) {
                this.debugLog('Auto-saving settings...');
                this.saveSettings();
            }
        }, 5 * 60 * 1000);
    }

    showStatus(message, type) {
        const statusElement = document.getElementById('statusMessage');
        statusElement.textContent = message;
        statusElement.className = `status-message ${type}`;
        statusElement.style.display = 'block';
        
        // 3초 후 자동으로 숨김
        setTimeout(() => {
            statusElement.style.display = 'none';
        }, 3000);
    }

    debugLog(message, data = null) {
        if (this.currentSettings.debugMode) {
            const timestamp = new Date().toISOString();
            const logMessage = `[Universal AI Assistant Options] [${timestamp}] ${message}`;
            
            if (data) {
                console.log(logMessage, data);
            } else {
                console.log(logMessage);
            }
        }
    }
}

// ────────────────────────────────────────────────────────────────────────────
// 페이지 로드 시 초기화
// ────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    new UniversalAIOptionsManager();
});

// ────────────────────────────────────────────────────────────────────────────
// 전역 유틸리티 함수들
// ────────────────────────────────────────────────────────────────────────────

// 디버그용 전역 함수
window.debugOptions = function() {
    console.log('=== Universal AI Assistant Options Debug ===');
    console.log('Current settings:', window.optionsManager?.currentSettings);
    console.log('Has unsaved changes:', window.optionsManager?.hasUnsavedChanges);
    console.log('Extension enabled:', window.optionsManager?.currentSettings?.extensionEnabled);
};

// 빠른 리셋 함수 (개발용)
window.quickReset = function() {
    if (confirm('정말로 모든 설정과 통계를 초기화하시겠습니까?')) {
        chrome.storage.local.clear().then(() => {
            location.reload();
        });
    }
};

// 설정 내보내기 (개발용)
window.exportDebugSettings = function() {
    chrome.storage.local.get(null).then(data => {
        console.log('All stored data:', data);
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'universal-ai-debug-data.json';
        a.click();
        URL.revokeObjectURL(url);
    });
};