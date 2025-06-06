// ─────────────────────────────────────────────────────────────────────────────
// Universal AI Assistant - Grok Service Module (content_grok.js)
// Multi-Chat + MD Export 통합 기능 제공
// ─────────────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════════
// Grok 통합 인터페이스 클래스
// ═══════════════════════════════════════════════════════════════════════════════

class GrokInterface extends window.UniversalAIAssistant.BaseAISiteInterface {
    constructor() {
        super('grok');
        this.serviceName = 'Grok';
        this.serviceEmoji = '🚀';
        
        // Grok 환경 감지
        this.environment = this.detectGrokEnvironment();
        
        // 디버그 로그
        window.UniversalAIAssistant.utils.debugLog('grok', 'GrokInterface initialized', {
            environment: this.environment,
            url: window.location.href,
            hostname: window.location.hostname
        });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Grok 환경 감지 및 분류
    // ─────────────────────────────────────────────────────────────────────────────

    detectGrokEnvironment() {
        const hostname = window.location.hostname.toLowerCase();
        const pathname = window.location.pathname.toLowerCase();
        const fullUrl = window.location.href.toLowerCase();
        const title = document.title.toLowerCase();

        // 1. 독립 Grok 사이트 (grok.com)
        if (hostname.includes('grok.com')) {
            return {
                type: 'standalone',
                platform: 'grok.com',
                description: 'Standalone Grok website'
            };
        }

        // 2. X.com 내부 Grok
        if (hostname.includes('x.com') || hostname.includes('twitter.com')) {
            // Grok 관련 경로나 요소 확인
            const isGrokPage = pathname.includes('grok') || 
                              pathname.includes('/i/grok') ||
                              fullUrl.includes('grok') ||
                              title.includes('grok');
            
            if (isGrokPage) {
                return {
                    type: 'integrated',
                    platform: 'x.com',
                    description: 'Grok integrated in X.com'
                };
            }
        }

        // 3. 기타 Grok 앱이나 임베드된 형태
        const hasGrokElements = document.querySelector('[data-testid*="grok"], [class*="grok"], [id*="grok"]');
        if (hasGrokElements) {
            return {
                type: 'embedded',
                platform: 'unknown',
                description: 'Grok embedded or app version'
            };
        }

        // 4. 미감지 상태
        return {
            type: 'unknown',
            platform: 'unknown',
            description: 'Grok environment not clearly detected'
        };
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Multi-Chat 기능: 셀렉터 정의
    // ─────────────────────────────────────────────────────────────────────────────

    getSelectors() {
        const commonSelectors = {
            // 공통 입력 요소들
            messageInput: [
                // Grok 전용 셀렉터들
                '[data-testid="grok-input"]',
                '[data-testid="chat-input"]',
                '[data-testid="message-input"]',
                '[placeholder*="Ask Grok"]',
                '[placeholder*="Message Grok"]',
                '[placeholder*="Talk to Grok"]',
                
                // 일반적인 채팅 입력 요소들
                'textarea[placeholder*="Ask"]',
                'textarea[placeholder*="Message"]',
                'textarea[placeholder*="Chat"]',
                'div[contenteditable="true"][role="textbox"]',
                'div[contenteditable="true"]',
                'textarea',
                'input[type="text"]',
                
                // 클래스 기반 셀렉터들
                '.chat-input',
                '.message-input',
                '.grok-input',
                '[class*="input"][class*="chat"]',
                '[class*="input"][class*="message"]'
            ],
            
            sendButton: [
                // Grok 전용 버튼들
                '[data-testid="grok-send"]',
                '[data-testid="send-button"]',
                '[data-testid="submit-button"]',
                '[aria-label*="Send to Grok"]',
                '[aria-label*="Send message"]',
                
                // 일반적인 전송 버튼들
                'button[type="submit"]:not([disabled])',
                'button[aria-label*="Send"]:not([disabled])',
                'button:has(svg):not([disabled])',
                'form button:not([disabled])',
                
                // 클래스 기반 버튼들
                'button[class*="send"]:not([disabled])',
                'button[class*="submit"]:not([disabled])',
                '.send-button:not([disabled])',
                '.submit-button:not([disabled])'
            ],
            
            responseContainer: [
                // Grok 응답 컨테이너들
                '[data-testid="grok-response"]',
                '[data-testid="grok-message"]',
                '[data-testid="assistant-message"]',
                '[data-testid="message-content"]',
                
                // 일반적인 응답 컨테이너들
                '.grok-response',
                '.assistant-message',
                '.ai-message',
                '.chat-message',
                '.message-content',
                '.response-content',
                '.prose:not([data-streaming="true"])',
                
                // 메시지 구조 기반
                '[class*="message"]:not([class*="input"])',
                '[class*="response"]',
                '[role="article"]',
                'article'
            ],
            
            loadingIndicator: [
                // Grok 로딩 상태들
                '[data-testid="grok-loading"]',
                '[data-testid="thinking"]',
                '[data-testid="generating"]',
                '[data-streaming="true"]',
                
                // 일반적인 로딩 인디케이터들
                '.loading',
                '.thinking',
                '.generating',
                '.spinner',
                '.animate-pulse',
                '.dots-loading',
                
                // 클래스 기반 로딩들
                '[class*="loading"]',
                '[class*="thinking"]',
                '[class*="generating"]',
                '[class*="spinner"]'
            ]
        };

        // 환경별 특화 셀렉터 추가
        if (this.environment.type === 'integrated' && this.environment.platform === 'x.com') {
            // X.com 통합 환경의 특수 셀렉터들
            commonSelectors.messageInput.unshift(
                '[data-testid="tweetTextarea_0"]', // X.com의 일반적인 텍스트 영역
                '[data-testid="compose-text"]',
                '.public-DraftEditor-content[contenteditable="true"]'
            );
            
            commonSelectors.sendButton.unshift(
                '[data-testid="tweetButton"]',
                '[data-testid="tweetButtonInline"]'
            );
        }

        return commonSelectors;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Multi-Chat 기능: 연결 확인
    // ─────────────────────────────────────────────────────────────────────────────

    async checkConnection() {
        try {
            if (!this.extensionEnabled) {
                return false;
            }

            // 입력 요소 확인
            const inputEl = this.findElement(this.getSelectors().messageInput);
            if (!inputEl) {
                window.UniversalAIAssistant.utils.debugLog('grok', 'No input element found');
                return false;
            }

            // 로그인 상태 확인 (환경별)
            const isLoggedIn = this.checkLoginStatus();
            
            // Grok 특화 요소 확인
            const hasGrokFeatures = this.checkGrokFeatures();

            const isConnected = isLoggedIn && hasGrokFeatures;

            window.UniversalAIAssistant.utils.debugLog('grok', 'Connection check result', {
                hasInput: !!inputEl,
                isLoggedIn,
                hasGrokFeatures,
                isConnected,
                environment: this.environment
            });

            return isConnected;
        } catch (error) {
            window.UniversalAIAssistant.utils.debugLog('grok', 'Connection check error:', error);
            return false;
        }
    }

    checkLoginStatus() {
        if (this.environment.type === 'integrated' && this.environment.platform === 'x.com') {
            // X.com에서는 X 계정 로그인 확인
            return !document.querySelector('.login-button, .sign-in, [data-testid="loginButton"]') &&
                   (document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]') ||
                    document.querySelector('[data-testid="AppTabBar_Profile_Link"]') ||
                    document.querySelector('.r-1p0dtai') !== null); // X.com 로그인 상태 지표
        } else if (this.environment.type === 'standalone') {
            // 독립 Grok 사이트에서는 Grok 계정 로그인 확인
            return !document.querySelector('.login-required, .auth-wall, .sign-in, [data-testid="login"]');
        } else {
            // 기타 환경에서는 기본적인 로그인 확인
            return !document.querySelector('.login, .sign-in, .auth-required');
        }
    }

    checkGrokFeatures() {
        // Grok 특화 기능들이 있는지 확인
        const grokIndicators = [
            // 텍스트 기반 확인
            () => document.title.toLowerCase().includes('grok'),
            () => document.body.textContent.toLowerCase().includes('grok'),
            
            // 요소 기반 확인
            () => document.querySelector('[data-testid*="grok"]'),
            () => document.querySelector('[class*="grok"]'),
            () => document.querySelector('[id*="grok"]'),
            
            // URL 기반 확인
            () => window.location.href.toLowerCase().includes('grok'),
            
            // 특정 UI 요소 확인 (Think 버튼, 음성 모드 등)
            () => document.querySelector('[aria-label*="Think"]'),
            () => document.querySelector('[data-testid*="think"]'),
            () => document.querySelector('.think-button, .reasoning-button')
        ];

        return grokIndicators.some(indicator => {
            try {
                return indicator();
            } catch {
                return false;
            }
        });
    }

    async testConnection() {
        try {
            if (!this.extensionEnabled) {
                return {
                    success: false,
                    error: '확장 프로그램이 비활성화되어 있습니다.'
                };
            }

            const inputEl = this.findElement(this.getSelectors().messageInput);
            const sendBtn = this.findElement(this.getSelectors().sendButton);

            if (!inputEl) {
                return { 
                    success: false, 
                    error: `Grok 메시지 입력창을 찾을 수 없습니다 (${this.environment.description})` 
                };
            }

            if (!sendBtn) {
                return { 
                    success: false, 
                    error: `Grok 전송 버튼을 찾을 수 없습니다 (${this.environment.description})` 
                };
            }

            // 입력창 포커스 테스트
            inputEl.focus();
            await this.sleep(100);

            return {
                success: true,
                message: `Grok 연결 테스트 성공`,
                details: {
                    site: this.siteName,
                    environment: this.environment,
                    inputElement: {
                        tag: inputEl.tagName.toLowerCase(),
                        type: inputEl.type || 'unknown',
                        contentEditable: inputEl.contentEditable || 'false'
                    },
                    url: window.location.href,
                    extensionEnabled: this.extensionEnabled
                }
            };
        } catch (error) {
            window.UniversalAIAssistant.utils.debugLog('grok', 'Test connection error:', error);
            return { success: false, error: error.message };
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Multi-Chat 기능: 메시지 전송
    // ─────────────────────────────────────────────────────────────────────────────

    async sendMessage(message) {
        try {
            if (!this.extensionEnabled) {
                return {
                    success: false,
                    error: '확장 프로그램이 비활성화되어 있습니다.',
                    site: this.siteName,
                    extensionDisabled: true
                };
            }

            if (this.isSending) {
                return { success: false, error: '전송 대기 중입니다.' };
            }
            this.isSending = true;

            window.UniversalAIAssistant.utils.debugLog('grok', `Sending message to Grok (${this.environment.description}):`, message);

            // 입력 요소 찾기
            const inputEl = this.findElement(this.getSelectors().messageInput);
            if (!inputEl) {
                throw new Error(`Grok 메시지 입력창을 찾을 수 없습니다 (${this.environment.description})`);
            }

            // 환경별 특화 입력 처리
            await this.performGrokInput(inputEl, message);
            await this.sleep(800);

            // 전송 버튼 처리
            await this.performGrokSend(inputEl);

            window.UniversalAIAssistant.utils.debugLog('grok', `Message sent to Grok successfully`);
            return {
                success: true,
                message: '메시지 전송 완료',
                site: this.siteName,
                environment: this.environment.description,
                extensionEnabled: this.extensionEnabled
            };

        } catch (error) {
            window.UniversalAIAssistant.utils.debugLog('grok', 'Send message error:', error);
            return {
                success: false,
                error: error.message,
                site: this.siteName,
                extensionEnabled: this.extensionEnabled
            };
        } finally {
            this.isSending = false;
        }
    }

    async performGrokInput(inputEl, message) {
        // 환경별 최적화된 입력 처리
        if (this.environment.type === 'integrated' && this.environment.platform === 'x.com') {
            return await this.inputForXIntegrated(inputEl, message);
        } else if (this.environment.type === 'standalone') {
            return await this.inputForStandalone(inputEl, message);
        } else {
            // 기본 강력한 입력 방식 사용
            return await this.inputHandler.typeMessageRobust(inputEl, message);
        }
    }

    async inputForXIntegrated(inputEl, message) {
        try {
            window.UniversalAIAssistant.utils.debugLog('grok', 'Using X.com integrated input method');
            
            inputEl.focus();
            await this.sleep(200);

            // X.com의 텍스트 영역 특화 처리
            if (inputEl.tagName.toLowerCase() === 'div' && inputEl.contentEditable === 'true') {
                // ContentEditable div 처리 (X.com 스타일)
                inputEl.innerHTML = '';
                inputEl.textContent = message;
                
                // X.com 특화 이벤트들
                const events = ['input', 'keyup', 'compositionend', 'textInput'];
                events.forEach(eventType => {
                    inputEl.dispatchEvent(new Event(eventType, { bubbles: true }));
                });
                
                // React 이벤트 시뮬레이션
                const reactEvent = new Event('input', { bubbles: true });
                reactEvent.simulated = true;
                inputEl.dispatchEvent(reactEvent);
                
            } else if (inputEl.tagName.toLowerCase() === 'textarea') {
                // Textarea 처리
                const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
                setValue.call(inputEl, message);
                inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            }

            await this.sleep(300);
            return true;
        } catch (error) {
            window.UniversalAIAssistant.utils.debugLog('grok', 'X.com integrated input failed, using fallback');
            return await this.inputHandler.typeMessageRobust(inputEl, message);
        }
    }

    async inputForStandalone(inputEl, message) {
        try {
            window.UniversalAIAssistant.utils.debugLog('grok', 'Using standalone Grok input method');
            
            // 독립 Grok 사이트 최적화 입력
            inputEl.focus();
            await this.sleep(200);

            // 기존 내용 클리어
            if (inputEl.tagName.toLowerCase() === 'textarea') {
                inputEl.value = '';
            } else {
                inputEl.textContent = '';
            }

            await this.sleep(100);

            // 메시지 입력
            if (inputEl.tagName.toLowerCase() === 'textarea') {
                inputEl.value = message;
                inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                inputEl.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (inputEl.contentEditable === 'true') {
                inputEl.textContent = message;
                inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            }

            await this.sleep(300);
            return true;
        } catch (error) {
            window.UniversalAIAssistant.utils.debugLog('grok', 'Standalone input failed, using fallback');
            return await this.inputHandler.typeMessageRobust(inputEl, message);
        }
    }

    async performGrokSend(inputEl) {
        const sendBtn = this.findElement(this.getSelectors().sendButton);
        
        if (sendBtn) {
            // 버튼 클릭 시도
            await this.buttonClicker.clickSendButtonRobust(sendBtn, inputEl);
        } else {
            // 백업: Enter 키 전송
            window.UniversalAIAssistant.utils.debugLog('grok', 'No send button found, trying Enter key');
            inputEl.focus();
            await this.sleep(100);
            
            // 다양한 Enter 키 시도
            const enterEvents = [
                { key: 'Enter', ctrlKey: false },
                { key: 'Enter', ctrlKey: true },
                { key: 'Enter', shiftKey: false }
            ];
            
            for (const eventData of enterEvents) {
                inputEl.dispatchEvent(new KeyboardEvent('keydown', {
                    ...eventData,
                    bubbles: true,
                    cancelable: true
                }));
                await this.sleep(200);
            }
        }
    }

    async getLatestResponse() {
        try {
            if (!this.extensionEnabled) {
                return {
                    responseText: null,
                    error: '확장 프로그램이 비활성화되어 있습니다.',
                    site: this.siteName
                };
            }

            // Grok 응답 대기
            await this.waitForGrokResponse();
            
            // 응답 요소들 찾기
            const responseElements = this.findElements(this.getSelectors().responseContainer);
            if (responseElements.length === 0) {
                return { responseText: null };
            }

            // 가장 최근 응답 추출
            const lastResponse = responseElements[responseElements.length - 1];
            const responseText = window.UniversalAIAssistant.utils.extractTextFromElement(lastResponse);

            return {
                responseText: responseText.trim(),
                site: this.siteName,
                environment: this.environment.description,
                extensionEnabled: this.extensionEnabled
            };
        } catch (error) {
            window.UniversalAIAssistant.utils.debugLog('grok', 'Get latest response error:', error);
            return {
                responseText: null,
                error: error.message,
                site: this.siteName,
                extensionEnabled: this.extensionEnabled
            };
        }
    }

    async waitForGrokResponse(timeout = 45000) {
        // Grok은 복잡한 추론을 할 수 있어 응답 시간이 길 수 있음
        const startTime = Date.now();
        let sawLoading = false;

        while (Date.now() - startTime < timeout) {
            // 로딩 상태 감지
            const loadingEl = this.findElement(this.getSelectors().loadingIndicator);
            const isThinking = document.querySelector('[data-testid*="thinking"], .thinking, .reasoning');
            const isGenerating = document.querySelector('[data-testid*="generating"], .generating');

            if (loadingEl || isThinking || isGenerating) {
                sawLoading = true;
            } else if (sawLoading) {
                // 응답 생성 완료 후 추가 대기
                await this.sleep(2000);
                return;
            }
            
            await this.sleep(1000);
        }

        if (!sawLoading) {
            // 로딩 상태를 못 봤다면 바로 리턴
            return;
        }
        
        throw new Error('Grok 응답 대기 시간 초과');
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // MD Export 기능: 대화 데이터 추출
    // ─────────────────────────────────────────────────────────────────────────────

    getConversationData() {
        window.UniversalAIAssistant.utils.debugLog('grok', 'Starting Grok conversation data extraction');
        
        const title = this.extractTitle();
        const messageData = this.analyzeMessageStructure();

        return {
            title: title,
            userMessages: messageData.userCount,
            assistantMessages: messageData.assistantCount,
            totalMessages: messageData.userCount + messageData.assistantCount,
            serviceName: this.serviceName,
            environment: this.environment.description,
            detectionMethod: messageData.method
        };
    }

    analyzeMessageStructure() {
        // 다양한 방법으로 메시지 구조 분석
        const methods = [
            () => this.analyzeByDataTestId(),
            () => this.analyzeByClasses(),
            () => this.analyzeByContent(),
            () => this.analyzeByStructure(),
            () => this.analyzeByFallback()
        ];

        for (const method of methods) {
            try {
                const result = method();
                if (result.userCount > 0 || result.assistantCount > 0) {
                    window.UniversalAIAssistant.utils.debugLog('grok', `Message analysis successful with method: ${result.method}`);
                    return result;
                }
            } catch (error) {
                window.UniversalAIAssistant.utils.debugLog('grok', `Message analysis method failed:`, error);
            }
        }

        return { userCount: 0, assistantCount: 0, method: 'all-failed' };
    }

    analyzeByDataTestId() {
        const userMessages = document.querySelectorAll(
            '[data-testid*="user"], [data-testid*="human-message"]'
        );
        const assistantMessages = document.querySelectorAll(
            '[data-testid*="assistant"], [data-testid*="grok"], [data-testid*="ai-message"]'
        );

        return {
            userCount: userMessages.length,
            assistantCount: assistantMessages.length,
            method: 'data-testid'
        };
    }

    analyzeByClasses() {
        const userMessages = document.querySelectorAll(
            '.user-message, [class*="user-"], [class*="human-"]'
        );
        const assistantMessages = document.querySelectorAll(
            '.grok-message, .assistant-message, [class*="grok-"], [class*="assistant-"], [class*="ai-"]'
        );

        return {
            userCount: userMessages.length,
            assistantCount: assistantMessages.length,
            method: 'css-classes'
        };
    }

    analyzeByContent() {
        // 텍스트 패턴으로 사용자 질문과 AI 응답 구분
        const allTextElements = document.querySelectorAll('p, div, span, article');
        let userCount = 0;
        let assistantCount = 0;
        const processedTexts = new Set();

        allTextElements.forEach(element => {
            const text = element.textContent.trim();
            if (text.length < 20 || text.length > 2000) return;

            const textSignature = text.substring(0, 50);
            if (processedTexts.has(textSignature)) return;
            processedTexts.add(textSignature);

            // 사용자 질문 패턴
            if (this.isUserQuestion(text)) {
                userCount++;
            }
            // AI 응답 패턴  
            else if (this.isAssistantResponse(text)) {
                assistantCount++;
            }
        });

        return {
            userCount,
            assistantCount,
            method: 'content-analysis'
        };
    }

    isUserQuestion(text) {
        const userPatterns = [
            text.endsWith('?'),
            /^(what|how|why|when|where|who|can you|could you|please|tell me)/i.test(text),
            /^(explain|describe|help|show me|give me)/i.test(text),
            text.length < 200 && text.includes('?')
        ];
        return userPatterns.some(pattern => pattern);
    }

    isAssistantResponse(text) {
        const assistantPatterns = [
            text.length > 100,
            /^(here|based on|according to|i understand|let me|sure)/i.test(text),
            text.includes('I can help') || text.includes('I\'ll help'),
            text.includes('explanation') || text.includes('analysis'),
            /\b(therefore|however|furthermore|additionally|moreover)\b/i.test(text)
        ];
        return assistantPatterns.some(pattern => pattern);
    }

    analyzeByStructure() {
        // DOM 구조 기반 분석
        const chatContainer = document.querySelector(
            'main, [role="main"], .chat-container, .conversation, .messages'
        );
        
        if (!chatContainer) {
            return { userCount: 0, assistantCount: 0, method: 'no-structure' };
        }

        const messageElements = chatContainer.querySelectorAll(
            'div, section, article, [role="article"], .message'
        );

        let userCount = 0;
        let assistantCount = 0;

        messageElements.forEach(element => {
            const classes = element.className.toLowerCase();
            const dataAttrs = Array.from(element.attributes)
                .map(attr => attr.name + '=' + attr.value)
                .join(' ')
                .toLowerCase();

            if (classes.includes('user') || dataAttrs.includes('user')) {
                userCount++;
            } else if (classes.includes('grok') || classes.includes('assistant') || 
                      dataAttrs.includes('grok') || dataAttrs.includes('assistant')) {
                assistantCount++;
            }
        });

        return {
            userCount,
            assistantCount,
            method: 'dom-structure'
        };
    }

    analyzeByFallback() {
        // 최소한의 감지 - 페이지에 의미있는 내용이 있으면 기본값 반환
        const bodyText = document.body.textContent.trim();
        const hasGrokElements = document.querySelector('[class*="grok"], [data-testid*="grok"]');
        const hasConversationElements = document.querySelector('.message, .chat, .conversation');

        if (bodyText.length > 500 || hasGrokElements || hasConversationElements) {
            return {
                userCount: 1,
                assistantCount: 1,
                method: 'fallback-detection'
            };
        }

        return {
            userCount: 0,
            assistantCount: 0,
            method: 'no-content'
        };
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // MD Export 기능: 제목 추출
    // ─────────────────────────────────────────────────────────────────────────────

    extractTitle() {
        const titleSources = [
            // 1. Grok 특화 제목 요소들
            () => {
                const grokTitleSelectors = [
                    '[data-testid*="conversation-title"]',
                    '[data-testid*="chat-title"]',
                    '.conversation-title',
                    '.chat-title',
                    '.grok-title'
                ];
                
                for (const selector of grokTitleSelectors) {
                    const element = document.querySelector(selector);
                    if (element && element.textContent.trim()) {
                        return element.textContent.trim();
                    }
                }
            },

            // 2. 첫 번째 사용자 메시지에서 제목 생성
            () => {
                const firstUserMessage = document.querySelector(
                    '[data-testid*="user"], .user-message, [class*="user-"]'
                );
                
                if (firstUserMessage) {
                    const text = firstUserMessage.textContent.trim();
                    if (text.length > 10) {
                        // 첫 문장이나 첫 줄을 제목으로 사용
                        const firstSentence = text.split(/[.!?\n]/)[0].trim();
                        return firstSentence.length > 100 ? 
                            firstSentence.substring(0, 100) + '...' : 
                            firstSentence;
                    }
                }
            },

            // 3. 페이지 제목에서 Grok 관련 부분 제거
            () => {
                let title = document.title;
                
                // Grok, X, Twitter 관련 텍스트 제거
                title = title.replace(/\bGrok\b/gi, '')
                            .replace(/\bX\b(?!\w)/gi, '')
                            .replace(/\bTwitter\b/gi, '')
                            .replace(/[-|•]/g, '')
                            .trim();
                
                if (title.length > 5) {
                    return title;
                }
            },

            // 4. 메타 태그에서 추출
            () => {
                const metaTitle = document.querySelector('meta[property="og:title"]');
                if (metaTitle) {
                    const title = metaTitle.getAttribute('content');
                    if (title && !title.toLowerCase().includes('grok') && title.length > 5) {
                        return title;
                    }
                }
            },

            // 5. 헤딩 요소에서 추출
            () => {
                const headings = document.querySelectorAll('h1, h2, h3, [role="heading"]');
                for (const heading of headings) {
                    const text = heading.textContent.trim();
                    if (text.length > 5 && text.length < 200 && 
                        !text.toLowerCase().includes('grok') &&
                        !text.toLowerCase().includes('x.com')) {
                        return text;
                    }
                }
            },

            // 6. URL에서 추출
            () => {
                const pathname = window.location.pathname;
                const searchParams = new URLSearchParams(window.location.search);
                
                // URL 파라미터에서 제목 추출
                const titleParam = searchParams.get('title') || searchParams.get('q');
                if (titleParam) {
                    return decodeURIComponent(titleParam);
                }
                
                // 경로에서 의미있는 부분 추출
                const pathParts = pathname.split('/').filter(part => 
                    part && part !== 'grok' && part !== 'chat' && part.length > 2
                );
                
                if (pathParts.length > 0) {
                    return pathParts[pathParts.length - 1]
                        .replace(/[-_]/g, ' ')
                        .replace(/\b\w/g, l => l.toUpperCase());
                }
            }
        ];

        // 각 소스에서 제목 추출 시도
        for (const source of titleSources) {
            try {
                const title = source();
                if (title && title.length > 0) {
                    window.UniversalAIAssistant.utils.debugLog('grok', 'Title extracted:', title);
                    return title;
                }
            } catch (error) {
                window.UniversalAIAssistant.utils.debugLog('grok', 'Title extraction error:', error);
            }
        }

        // 기본 제목
        return `Grok 대화 (${this.environment.description})`;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // MD Export 기능: 마크다운 생성
    // ─────────────────────────────────────────────────────────────────────────────

    generateMarkdown(includeUser, includeAssistant) {
        window.UniversalAIAssistant.utils.debugLog('grok', 'Generating Grok markdown', { 
            includeUser, 
            includeAssistant,
            environment: this.environment.description
        });

        const generationMethods = [
            () => this.generateByDataTestId(includeUser, includeAssistant),
            () => this.generateByClasses(includeUser, includeAssistant),
            () => this.generateByContentAnalysis(includeUser, includeAssistant),
            () => this.generateByStructure(includeUser, includeAssistant),
            () => this.generateByTextBlocks(includeUser, includeAssistant)
        ];

        for (const method of generationMethods) {
            try {
                const markdown = method();
                if (markdown && markdown.trim().length > 50) {
                    window.UniversalAIAssistant.utils.debugLog('grok', 'Markdown generation successful');
                    return markdown;
                }
            } catch (error) {
                window.UniversalAIAssistant.utils.debugLog('grok', 'Markdown generation method failed:', error);
            }
        }

        return this.generateFallbackMarkdown(includeUser, includeAssistant);
    }

    generateByDataTestId(includeUser, includeAssistant) {
        let markdown = '';
        
        // data-testid 기반으로 메시지 추출
        const userMessages = document.querySelectorAll('[data-testid*="user"], [data-testid*="human"]');
        const assistantMessages = document.querySelectorAll('[data-testid*="assistant"], [data-testid*="grok"], [data-testid*="ai"]');
        
        // 메시지들을 시간순으로 정렬
        const allMessages = [];
        userMessages.forEach(msg => allMessages.push({ type: 'user', element: msg }));
        assistantMessages.forEach(msg => allMessages.push({ type: 'assistant', element: msg }));
        
        // DOM 순서로 정렬
        allMessages.sort((a, b) => {
            return a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
        });

        allMessages.forEach((msg, index) => {
            if (msg.type === 'user' && includeUser) {
                const text = window.UniversalAIAssistant.utils.extractTextFromElement(msg.element);
                if (text.trim()) {
                    markdown += `## 👤 사용자\n\n${text}\n\n`;
                }
            } else if (msg.type === 'assistant' && includeAssistant) {
                const text = window.UniversalAIAssistant.utils.extractTextFromElement(msg.element);
                if (text.trim()) {
                    markdown += `## ${this.serviceEmoji} ${this.serviceName}\n\n${text}\n\n`;
                }
            }
            
            if (index < allMessages.length - 1) {
                markdown += '---\n\n';
            }
        });

        return markdown;
    }

    generateByClasses(includeUser, includeAssistant) {
        let markdown = '';
        
        // 클래스 기반으로 메시지 추출
        const userMessages = document.querySelectorAll('.user-message, [class*="user-"], [class*="human-"]');
        const assistantMessages = document.querySelectorAll('.grok-message, .assistant-message, [class*="grok-"], [class*="assistant-"]');
        
        const allMessages = [];
        userMessages.forEach(msg => allMessages.push({ type: 'user', element: msg }));
        assistantMessages.forEach(msg => allMessages.push({ type: 'assistant', element: msg }));
        
        allMessages.sort((a, b) => {
            return a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
        });

        allMessages.forEach((msg, index) => {
            if (msg.type === 'user' && includeUser) {
                const text = window.UniversalAIAssistant.utils.extractTextFromElement(msg.element);
                if (text.trim()) {
                    markdown += `## 👤 사용자\n\n${text}\n\n`;
                }
            } else if (msg.type === 'assistant' && includeAssistant) {
                const text = window.UniversalAIAssistant.utils.extractTextFromElement(msg.element);
                if (text.trim()) {
                    markdown += `## ${this.serviceEmoji} ${this.serviceName}\n\n${text}\n\n`;
                }
            }
            
            if (index < allMessages.length - 1) {
                markdown += '---\n\n';
            }
        });

        return markdown;
    }

    generateByContentAnalysis(includeUser, includeAssistant) {
        let markdown = '';
        
        // 텍스트 패턴으로 분석하여 대화 추출
        const textElements = document.querySelectorAll('p, div, span, article');
        const conversations = [];
        const processedTexts = new Set();

        textElements.forEach(element => {
            const text = element.textContent.trim();
            if (text.length < 20 || text.length > 3000) return;

            const textSignature = text.substring(0, 50);
            if (processedTexts.has(textSignature)) return;
            processedTexts.add(textSignature);

            if (this.isUserQuestion(text)) {
                conversations.push({ type: 'user', text, element });
            } else if (this.isAssistantResponse(text)) {
                conversations.push({ type: 'assistant', text, element });
            }
        });

        // DOM 순서로 정렬
        conversations.sort((a, b) => {
            return a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
        });

        conversations.forEach((conv, index) => {
            if (conv.type === 'user' && includeUser) {
                markdown += `## 👤 사용자\n\n${conv.text}\n\n`;
            } else if (conv.type === 'assistant' && includeAssistant) {
                markdown += `## ${this.serviceEmoji} ${this.serviceName}\n\n${conv.text}\n\n`;
            }
            
            if (index < conversations.length - 1) {
                markdown += '---\n\n';
            }
        });

        return markdown;
    }

    generateByStructure(includeUser, includeAssistant) {
        let markdown = '';
        
        // DOM 구조 기반으로 메시지 추출
        const chatContainer = document.querySelector('main, [role="main"], .chat-container, .conversation');
        if (!chatContainer) return '';

        const messageElements = chatContainer.querySelectorAll('div, section, article');
        const messages = [];

        messageElements.forEach(element => {
            const text = element.textContent.trim();
            if (text.length < 30 || text.length > 5000) return;

            const classes = element.className.toLowerCase();
            const dataAttrs = Array.from(element.attributes).map(attr => attr.value).join(' ').toLowerCase();

            let messageType = null;
            if (classes.includes('user') || dataAttrs.includes('user') || this.isUserQuestion(text)) {
                messageType = 'user';
            } else if (classes.includes('grok') || classes.includes('assistant') || 
                      dataAttrs.includes('grok') || dataAttrs.includes('assistant') || 
                      this.isAssistantResponse(text)) {
                messageType = 'assistant';
            }

            if (messageType) {
                messages.push({ type: messageType, text, element });
            }
        });

        messages.forEach((msg, index) => {
            if (msg.type === 'user' && includeUser) {
                markdown += `## 👤 사용자\n\n${msg.text}\n\n`;
            } else if (msg.type === 'assistant' && includeAssistant) {
                markdown += `## ${this.serviceEmoji} ${this.serviceName}\n\n${msg.text}\n\n`;
            }
            
            if (index < messages.length - 1) {
                markdown += '---\n\n';
            }
        });

        return markdown;
    }

    generateByTextBlocks(includeUser, includeAssistant) {
        let markdown = '';
        
        // 전체 텍스트를 블록으로 나누어 분석
        const bodyText = document.body.textContent;
        const textBlocks = bodyText.split(/\n\s*\n+/).filter(block => block.trim().length > 30);

        textBlocks.forEach((block, index) => {
            const text = block.trim();
            
            if (this.isUserQuestion(text) && includeUser) {
                markdown += `## 👤 사용자\n\n${text}\n\n`;
            } else if (this.isAssistantResponse(text) && includeAssistant) {
                markdown += `## ${this.serviceEmoji} ${this.serviceName}\n\n${text}\n\n`;
            }
            
            if (index < textBlocks.length - 1 && 
                (this.isUserQuestion(text) || this.isAssistantResponse(text))) {
                markdown += '---\n\n';
            }
        });

        return markdown;
    }

    generateFallbackMarkdown(includeUser, includeAssistant) {
        window.UniversalAIAssistant.utils.debugLog('grok', 'Using fallback markdown generation');
        
        let markdown = '';
        const title = this.extractTitle();

        if (includeUser) {
            markdown += `## 👤 사용자\n\n${title}\n\n`;
        }

        if (includeAssistant) {
            const bodyText = document.body.textContent.trim();
            
            // 의미있는 텍스트 추출
            let meaningfulText = '';
            if (bodyText.length > 200) {
                // 긴 텍스트에서 Grok 응답으로 보이는 부분 추출
                const sentences = bodyText.split(/[.!?]\s+/).filter(sentence => 
                    sentence.length > 50 && sentence.length < 1000
                );
                
                meaningfulText = sentences.slice(0, 5).join('. ');
                if (meaningfulText.length > 1500) {
                    meaningfulText = meaningfulText.substring(0, 1500) + '...';
                }
            }
            
            if (!meaningfulText) {
                meaningfulText = '대화 내용을 추출할 수 없습니다.';
            }

            markdown += `## ${this.serviceEmoji} ${this.serviceName}\n\n${meaningfulText}\n\n`;
        }

        return markdown || `# ${title}\n\n대화 내용을 찾을 수 없습니다.`;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // 고급 기능 및 초기화
    // ─────────────────────────────────────────────────────────────────────────────

    checkForRelevantChanges() {
        // Grok 특화 DOM 변화 감지
        const grokSelectors = [
            '[data-testid*="grok"]',
            '[data-testid*="message"]',
            '[data-testid*="chat"]',
            '[data-testid*="conversation"]',
            '.grok-message',
            '.chat-message',
            '.conversation',
            'textarea[placeholder*="Ask"]',
            'div[contenteditable="true"]'
        ];

        return grokSelectors.some(selector => {
            try {
                return document.querySelector(selector) !== null;
            } catch {
                return false;
            }
        });
    }

    initialize() {
        window.UniversalAIAssistant.utils.debugLog('grok', 'Initializing Grok module', {
            environment: this.environment,
            url: window.location.href
        });

        // Grok 특화 초기화
        this.setupGrokObserver();
        this.analyzeGrokInterface();
        this.detectGrokFeatures();
        
        // 환경별 특화 초기화
        if (this.environment.type === 'integrated') {
            this.initializeXIntegration();
        } else if (this.environment.type === 'standalone') {
            this.initializeStandalone();
        }
    }

    setupGrokObserver() {
        // Grok 특화 DOM 변화 관찰자
        const observer = new MutationObserver(window.UniversalAIAssistant.utils.debounce(() => {
            window.UniversalAIAssistant.utils.debugLog('grok', 'Grok interface changes detected');
            this.analyzeGrokInterface();
        }, 2000));

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'data-testid', 'aria-label', 'data-streaming']
        });

        window.UniversalAIAssistant.utils.debugLog('grok', 'Grok observer setup complete');
    }

    analyzeGrokInterface() {
        const analysis = {
            environment: this.environment,
            elements: {
                inputElements: this.findElements(this.getSelectors().messageInput).length,
                sendButtons: this.findElements(this.getSelectors().sendButton).length,
                responseContainers: this.findElements(this.getSelectors().responseContainer).length,
                loadingIndicators: this.findElements(this.getSelectors().loadingIndicator).length
            },
            features: {
                hasThinkButton: !!document.querySelector('[data-testid*="think"], .think-button'),
                hasVoiceMode: !!document.querySelector('[data-testid*="voice"], .voice-button'),
                hasImageUpload: !!document.querySelector('[data-testid*="image"], [type="file"]'),
                hasGrokBranding: document.body.textContent.toLowerCase().includes('grok')
            },
            urls: {
                current: window.location.href,
                pathname: window.location.pathname,
                search: window.location.search
            }
        };

        window.UniversalAIAssistant.utils.debugLog('grok', 'Grok interface analysis:', analysis);
        return analysis;
    }

    detectGrokFeatures() {
        // Grok 3의 새로운 기능들 감지
        const features = {
            grok3: document.body.textContent.includes('Grok 3'),
            thinkMode: !!document.querySelector('[data-testid*="think"], .think'),
            voiceMode: !!document.querySelector('[data-testid*="voice"], .voice'),
            realtimeSearch: document.body.textContent.includes('real-time') || 
                           document.body.textContent.includes('실시간'),
            imageGeneration: document.body.textContent.includes('image generation') ||
                           !!document.querySelector('[data-testid*="image-gen"]')
        };

        window.UniversalAIAssistant.utils.debugLog('grok', 'Grok features detected:', features);
        return features;
    }

    initializeXIntegration() {
        // X.com 통합 환경에서의 특화 초기화
        window.UniversalAIAssistant.utils.debugLog('grok', 'Initializing X.com integration');
        
        // X.com의 라우팅 변화 감지
        this.observeXNavigation();
    }

    initializeStandalone() {
        // 독립 Grok 사이트에서의 특화 초기화
        window.UniversalAIAssistant.utils.debugLog('grok', 'Initializing standalone Grok');
        
        // 독립 사이트의 특수 기능들 활성화
        this.setupStandaloneFeatures();
    }

    observeXNavigation() {
        // X.com의 SPA 네비게이션 감지
        const observer = new MutationObserver(() => {
            const currentPath = window.location.pathname;
            if (currentPath.includes('grok')) {
                window.UniversalAIAssistant.utils.debugLog('grok', 'X.com Grok navigation detected');
                setTimeout(() => this.analyzeGrokInterface(), 1000);
            }
        });

        observer.observe(document.head, {
            childList: true,
            subtree: true
        });
    }

    setupStandaloneFeatures() {
        // 독립 Grok 사이트의 특수 기능들 설정
        setTimeout(() => {
            const features = this.detectGrokFeatures();
            if (features.thinkMode) {
                window.UniversalAIAssistant.utils.debugLog('grok', 'Think mode available');
            }
            if (features.voiceMode) {
                window.UniversalAIAssistant.utils.debugLog('grok', 'Voice mode available');
            }
        }, 2000);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 서비스 모듈 등록 및 디버그 함수
// ═══════════════════════════════════════════════════════════════════════════════

// aiServiceModule을 전역에 등록
window.aiServiceModule = new GrokInterface();

// Grok 전용 디버그 함수들
window.debugGrok = function() {
    if (window.aiServiceModule && window.aiServiceModule.serviceName === 'Grok') {
        console.log('=== 🚀 Grok Debug Information ===');
        console.log('Service Module:', window.aiServiceModule);
        console.log('Environment:', window.aiServiceModule.environment);
        console.log('Interface Analysis:', window.aiServiceModule.analyzeGrokInterface());
        console.log('Features:', window.aiServiceModule.detectGrokFeatures());
        
        // 연결 테스트
        window.aiServiceModule.checkConnection().then(connected => {
            console.log('Connection Status:', connected);
        });
        
        // 대화 데이터 테스트
        try {
            const conversationData = window.aiServiceModule.getConversationData();
            console.log('Conversation Data:', conversationData);
        } catch (error) {
            console.log('Conversation Data Error:', error);
        }

        // 마크다운 생성 테스트
        try {
            const markdown = window.aiServiceModule.generateMarkdown(true, true);
            console.log('Markdown Preview (500 chars):', markdown.substring(0, 500) + '...');
        } catch (error) {
            console.log('Markdown Generation Error:', error);
        }
    } else {
        console.log('❌ Grok module not loaded or not on Grok page');
    }
};

// 빠른 Grok 상태 확인
window.quickGrokCheck = function() {
    const grok = window.aiServiceModule;
    if (grok && grok.serviceName === 'Grok') {
        console.log('🚀 Quick Grok Status');
        console.log(`   Environment: ${grok.environment.type} (${grok.environment.platform})`);
        console.log(`   Extension Enabled: ${grok.extensionEnabled}`);
        console.log(`   URL: ${window.location.href}`);
        
        grok.checkConnection().then(connected => {
            console.log(`   Connected: ${connected}`);
        });
        
        const data = grok.getConversationData();
        console.log(`   Messages: User: ${data.userMessages}, Grok: ${data.assistantMessages}`);
        console.log(`   Detection Method: ${data.detectionMethod}`);
    } else {
        console.log('❌ Grok module not available');
    }
};

// Grok 테스트 메시지 전송
window.testGrokMessage = async function(message = "안녕하세요, Grok! 테스트 메시지입니다.") {
    const grok = window.aiServiceModule;
    if (grok && grok.serviceName === 'Grok') {
        console.log('🚀 Testing Grok message sending...');
        try {
            const result = await grok.sendMessage(message);
            console.log('Send Result:', result);
            
            if (result.success) {
                console.log('✅ Message sent successfully!');
                setTimeout(async () => {
                    try {
                        const response = await grok.getLatestResponse();
                        console.log('Grok Response:', response);
                    } catch (error) {
                        console.log('Error getting response:', error);
                    }
                }, 3000);
            } else {
                console.log('❌ Message sending failed:', result.error);
            }
        } catch (error) {
            console.log('❌ Test failed:', error);
        }
    } else {
        console.log('❌ Grok module not available for testing');
    }
};

// 모듈 로딩 완료 로그
window.UniversalAIAssistant.utils.debugLog('grok', 'Grok service module loaded successfully', {
    environment: window.aiServiceModule.environment,
    url: window.location.href,
    timestamp: new Date().toISOString()
});

console.log('🚀 Universal AI Assistant - Grok Service Module 로드 완료');
console.log(`   Environment: ${window.aiServiceModule.environment.description}`);
console.log('   Debug: window.debugGrok() | Quick Check: window.quickGrokCheck()');
console.log('   Test: window.testGrokMessage("your message")');