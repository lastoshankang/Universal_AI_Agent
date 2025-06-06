// ─────────────────────────────────────────────────────────────────────────────
// Universal AI Assistant - Gemini Service Module (content_gemini.js)
// Multi-Chat + MD Export 통합 기능 제공
// ─────────────────────────────────────────────────────────────────────────────

// Gemini 전용 인터페이스 클래스
class GeminiInterface extends window.UniversalAIAssistant.BaseAISiteInterface {
    constructor() {
        super('Gemini');
        this.serviceEmoji = '💎';
        this.serviceColor = '#4285f4';
        
        // Gemini 특화 설정
        this.maxRetries = 3;
        this.defaultTimeout = 45000; // Gemini는 검색이 포함되어 더 긴 시간 필요
        this.searchCheckInterval = 1500;
        
        debugLog('gemini', 'Gemini interface initialized');
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Gemini 선택자 정의
    // ─────────────────────────────────────────────────────────────────────────────

    getSelectors() {
        return {
            messageInput: [
                'rich-textarea[aria-label*="Enter a prompt"]',
                'rich-textarea[placeholder*="Enter"]',
                'div[contenteditable="true"]',
                'textarea[data-testid="prompt-textarea"]',
                '.ql-editor',
                'div[role="textbox"]',
                'textarea[placeholder*="Enter"]',
                'textarea[aria-label*="prompt"]',
                'textarea[placeholder*="Ask Gemini"]',
                'div[contenteditable="true"][aria-label*="prompt"]',
                'textarea[placeholder*="Type here"]',
                '[data-testid="chat-input"]'
            ],
            sendButton: [
                'button[aria-label*="Submit"]',
                'button[data-testid="send-button"]',
                'button:has(svg):not([disabled])',
                'form button[type="submit"]:not([disabled])',
                'button[aria-label*="Send"]',
                '.send-button:not([disabled])',
                'button[class*="send"]:not([disabled])',
                'button[data-testid="submit-button"]',
                'button[aria-label*="Generate"]',
                '[role="button"]:has(svg):not([disabled])'
            ],
            responseContainer: [
                '[data-response-index]:last-child',
                '.model-response-text',
                '[data-testid="model-response"]',
                '.response-container .markdown',
                '.message-content',
                '.assistant-message',
                '.response-content',
                '.gemini-response',
                'model-response',
                'user-query + model-response',
                '.conversation-container model-response'
            ],
            loadingIndicator: [
                '.loading',
                '.generating',
                '.animate-pulse',
                '[data-testid="loading"]',
                '.spinner',
                '.thinking',
                '.response-loading',
                '.gemini-thinking',
                '[data-testid="generating"]',
                '.search-progress',
                '.model-loading'
            ],
            conversationContainer: [
                '.conversation-container',
                'user-query',
                'model-response',
                '.chat-container',
                '.conversation-turn'
            ]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Multi-Chat 기능: 연결 확인
    // ─────────────────────────────────────────────────────────────────────────────

    async checkConnection() {
        try {
            if (!this.extensionEnabled) {
                debugLog('gemini', 'Extension disabled, returning false');
                return false;
            }

            // 입력창 확인
            const inputEl = this.findElement(this.getSelectors().messageInput);
            
            // 로그인 상태 확인 (Gemini는 Google 계정 필요)
            const loginIndicators = [
                '.sign-in', '.login-button', '[data-testid="sign-in"]',
                '.auth-required', '.login-required', 'button[data-testid="login"]',
                '.google-signin'
            ];
            const isLoggedOut = loginIndicators.some(selector => document.querySelector(selector));
            
            // Gemini 페이지 특성 확인
            const isGeminiPage = this.isValidGeminiPage();
            
            const isConnected = !!inputEl && !isLoggedOut && isGeminiPage;
            
            debugLog('gemini', 'Connection check result', {
                inputFound: !!inputEl,
                isLoggedIn: !isLoggedOut,
                isGeminiPage: isGeminiPage,
                connected: isConnected
            });
            
            return isConnected;
        } catch (error) {
            debugLog('gemini', 'Connection check error:', error);
            return false;
        }
    }

    isValidGeminiPage() {
        // Gemini 페이지인지 확인하는 다양한 방법
        const geminiIndicators = [
            () => document.title.toLowerCase().includes('gemini'),
            () => window.location.hostname.includes('gemini.google.com'),
            () => document.querySelector('[data-testid*="gemini"]'),
            () => document.querySelector('user-query'),
            () => document.querySelector('model-response'),
            () => document.querySelector('rich-textarea'),
            () => document.body.textContent.includes('Gemini'),
            () => document.querySelector('meta[name="description"]')?.content?.includes('Gemini')
        ];

        return geminiIndicators.some(check => {
            try {
                return check();
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
                    error: 'Gemini 메시지 입력창을 찾을 수 없습니다. Google 계정으로 로그인되었는지 확인해주세요.' 
                };
            }
            
            if (!sendBtn) {
                return { 
                    success: false, 
                    error: 'Gemini 전송 버튼을 찾을 수 없습니다.' 
                };
            }
            
            // 입력창 포커스 테스트
            try {
                inputEl.focus();
                await this.sleep(100);
            } catch (focusError) {
                debugLog('gemini', 'Focus test failed:', focusError);
            }
            
            return {
                success: true,
                message: 'Gemini 연결 테스트 성공',
                details: {
                    site: this.siteName,
                    inputTag: inputEl.tagName.toLowerCase(),
                    inputType: inputEl.type || 'contenteditable',
                    buttonFound: true,
                    buttonDisabled: sendBtn.disabled,
                    url: window.location.href,
                    extensionEnabled: this.extensionEnabled
                }
            };
        } catch (error) {
            debugLog('gemini', 'Test connection error:', error);
            return { 
                success: false, 
                error: `연결 테스트 실패: ${error.message}` 
            };
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Multi-Chat 기능: 메시지 전송
    // ─────────────────────────────────────────────────────────────────────────────

    async sendMessage(message) {
        try {
            if (!this.extensionEnabled) {
                debugLog('gemini', 'Message sending blocked: extension disabled');
                return { 
                    success: false, 
                    error: '확장 프로그램이 비활성화되어 있습니다.',
                    site: this.siteName,
                    extensionDisabled: true
                };
            }

            if (this.isSending) {
                debugLog('gemini', 'Message sending blocked: already sending');
                return { 
                    success: false, 
                    error: '이미 메시지 전송 중입니다.' 
                };
            }

            this.isSending = true;
            debugLog('gemini', 'Starting message send:', message.substring(0, 50) + '...');

            // 입력창 찾기
            const inputEl = this.findElement(this.getSelectors().messageInput);
            if (!inputEl) {
                throw new Error('Gemini 메시지 입력창을 찾을 수 없습니다.');
            }

            debugLog('gemini', 'Input element found', {
                tagName: inputEl.tagName,
                className: inputEl.className,
                type: inputEl.type,
                contentEditable: inputEl.contentEditable,
                isRichTextarea: inputEl.tagName.toLowerCase() === 'rich-textarea'
            });
            
            // 입력창 포커스
            inputEl.focus();
            await this.sleep(300);

            // Gemini 특화 입력 처리
            let inputSuccess = false;
            
            if (inputEl.tagName.toLowerCase() === 'rich-textarea') {
                inputSuccess = await this.handleRichTextareaInput(inputEl, message);
            } else if (inputEl.contentEditable === 'true') {
                inputSuccess = await this.handleContentEditableInput(inputEl, message);
            } else if (inputEl.tagName.toLowerCase() === 'textarea') {
                inputSuccess = await this.handleTextareaInput(inputEl, message);
            } else {
                // 범용 입력 처리
                try {
                    await this.inputHandler.typeMessageRobust(inputEl, message);
                    inputSuccess = true;
                } catch (error) {
                    debugLog('gemini', 'Standard input failed:', error.message);
                }
            }

            if (!inputSuccess) {
                throw new Error('모든 입력 방식이 실패했습니다.');
            }

            await this.sleep(800);

            // 전송 시도
            const sendResult = await this.handleMessageSend(inputEl);
            
            if (sendResult.success) {
                debugLog('gemini', 'Message sent successfully');
                return { 
                    success: true, 
                    message: '메시지 전송 완료', 
                    site: this.siteName,
                    extensionEnabled: this.extensionEnabled
                };
            } else {
                debugLog('gemini', 'Send verification failed, but message might be sent');
                return { 
                    success: true, // 부드러운 처리
                    message: '메시지 전송 시도 완료 (확인 불가)', 
                    site: this.siteName,
                    extensionEnabled: this.extensionEnabled,
                    warning: sendResult.warning || '전송 확인에 실패했지만 메시지가 전송되었을 수 있습니다.'
                };
            }

        } catch (error) {
            debugLog('gemini', 'Send message final error:', error);
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

    async handleRichTextareaInput(inputEl, message) {
        debugLog('gemini', 'Handling rich-textarea input');
        
        const inputMethods = [
            () => this.richTextareaMethod1(inputEl, message),
            () => this.richTextareaMethod2(inputEl, message),
            () => this.richTextareaMethod3(inputEl, message)
        ];

        for (let i = 0; i < inputMethods.length; i++) {
            try {
                debugLog('gemini', `Rich-textarea method ${i + 1} attempting`);
                await inputMethods[i]();
                
                // 입력 검증
                await this.sleep(500);
                const currentText = this.getRichTextareaValue(inputEl);
                if (currentText.includes(message.substring(0, 20))) {
                    debugLog('gemini', `Rich-textarea method ${i + 1} successful`);
                    return true;
                }
            } catch (error) {
                debugLog('gemini', `Rich-textarea method ${i + 1} failed:`, error.message);
            }
        }
        
        return false;
    }

    async richTextareaMethod1(inputEl, message) {
        // 방법 1: innerHTML을 통한 직접 설정
        inputEl.innerHTML = message;
        this.dispatchGeminiInputEvents(inputEl);
    }

    async richTextareaMethod2(inputEl, message) {
        // 방법 2: textContent 설정
        inputEl.textContent = message;
        this.dispatchGeminiInputEvents(inputEl);
    }

    async richTextareaMethod3(inputEl, message) {
        // 방법 3: 문자별 입력 시뮬레이션
        inputEl.innerHTML = '';
        inputEl.focus();
        
        for (const char of message) {
            inputEl.innerHTML += char;
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            await this.sleep(10);
        }
        
        this.dispatchGeminiInputEvents(inputEl);
    }

    getRichTextareaValue(inputEl) {
        return inputEl.textContent || inputEl.innerText || inputEl.innerHTML || '';
    }

    async handleContentEditableInput(inputEl, message) {
        debugLog('gemini', 'Handling contenteditable input');
        
        const methods = [
            () => this.contentEditableMethod1(inputEl, message),
            () => this.contentEditableMethod2(inputEl, message),
            () => this.contentEditableMethod3(inputEl, message)
        ];

        for (let i = 0; i < methods.length; i++) {
            try {
                debugLog('gemini', `ContentEditable method ${i + 1} attempting`);
                await methods[i]();
                
                await this.sleep(500);
                const currentText = inputEl.textContent || inputEl.innerText || '';
                if (currentText.includes(message.substring(0, 20))) {
                    debugLog('gemini', `ContentEditable method ${i + 1} successful`);
                    return true;
                }
            } catch (error) {
                debugLog('gemini', `ContentEditable method ${i + 1} failed:`, error.message);
            }
        }
        
        return false;
    }

    async contentEditableMethod1(inputEl, message) {
        inputEl.textContent = message;
        this.dispatchGeminiInputEvents(inputEl);
    }

    async contentEditableMethod2(inputEl, message) {
        inputEl.innerHTML = this.escapeHtml(message);
        this.dispatchGeminiInputEvents(inputEl);
    }

    async contentEditableMethod3(inputEl, message) {
        inputEl.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, message);
        this.dispatchGeminiInputEvents(inputEl);
    }

    async handleTextareaInput(inputEl, message) {
        debugLog('gemini', 'Handling textarea input');
        
        try {
            inputEl.value = message;
            this.dispatchGeminiInputEvents(inputEl);
            return true;
        } catch (error) {
            debugLog('gemini', 'Textarea input failed:', error.message);
            return false;
        }
    }

    dispatchGeminiInputEvents(inputEl) {
        const events = [
            'input', 'change', 'keyup', 'focus', 'blur',
            'textInput', 'compositionend', 'paste'
        ];
        
        events.forEach(eventType => {
            try {
                const event = new Event(eventType, { bubbles: true });
                inputEl.dispatchEvent(event);
            } catch (error) {
                debugLog('gemini', `Failed to dispatch ${eventType}:`, error);
            }
        });

        // 커스텀 이벤트도 발생
        try {
            inputEl.dispatchEvent(new CustomEvent('gemini-input', { 
                bubbles: true, 
                detail: { source: 'extension' } 
            }));
        } catch (error) {
            debugLog('gemini', 'Failed to dispatch custom event:', error);
        }
    }

    async handleMessageSend(inputEl) {
        debugLog('gemini', 'Starting message send process');
        
        // 전송 버튼 찾기
        const sendBtn = this.findElement(this.getSelectors().sendButton);
        
        if (sendBtn) {
            debugLog('gemini', 'Send button found, attempting click');
            return await this.attemptButtonClick(sendBtn, inputEl);
        } else {
            debugLog('gemini', 'No send button found, trying Enter key');
            return await this.attemptEnterKeySend(inputEl);
        }
    }

    async attemptButtonClick(sendBtn, inputEl) {
        // 버튼 활성화 대기
        let attempts = 0;
        const maxAttempts = 30;
        
        while (sendBtn.disabled && attempts < maxAttempts) {
            await this.sleep(200);
            attempts++;
        }
        
        if (sendBtn.disabled) {
            debugLog('gemini', 'Send button still disabled, proceeding anyway');
        }
        
        // 다양한 클릭 방법 시도
        const clickMethods = [
            () => this.directClick(sendBtn),
            () => this.mouseEventClick(sendBtn),
            () => this.coordinateClick(sendBtn),
            () => this.keyboardClick(sendBtn)
        ];
        
        for (let i = 0; i < clickMethods.length; i++) {
            try {
                debugLog('gemini', `Button click method ${i + 1} attempting`);
                await clickMethods[i]();
                await this.sleep(1000); // Gemini는 더 긴 대기 시간 필요
                
                const success = await this.verifyTransmissionSuccess(inputEl);
                if (success) {
                    debugLog('gemini', `Button click method ${i + 1} successful`);
                    return { success: true };
                }
            } catch (error) {
                debugLog('gemini', `Button click method ${i + 1} failed:`, error.message);
            }
        }
        
        return { 
            success: false, 
            warning: '버튼 클릭 방법들이 실패했습니다' 
        };
    }

    async directClick(button) {
        button.click();
    }

    async mouseEventClick(button) {
        button.dispatchEvent(new MouseEvent('click', { 
            bubbles: true, 
            cancelable: true 
        }));
    }

    async coordinateClick(button) {
        const rect = button.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        
        const events = ['mousedown', 'mouseup', 'click'];
        for (const eventType of events) {
            button.dispatchEvent(new MouseEvent(eventType, { 
                bubbles: true, 
                clientX: x, 
                clientY: y 
            }));
        }
    }

    async keyboardClick(button) {
        button.focus();
        button.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter',
            bubbles: true
        }));
    }

    async attemptEnterKeySend(inputEl) {
        debugLog('gemini', 'Attempting Enter key send');
        
        inputEl.focus();
        await this.sleep(300);
        
        const enterMethods = [
            () => this.simpleEnter(inputEl),
            () => this.ctrlEnter(inputEl),
            () => this.shiftEnter(inputEl)
        ];
        
        for (let i = 0; i < enterMethods.length; i++) {
            try {
                debugLog('gemini', `Enter method ${i + 1} attempting`);
                await enterMethods[i]();
                await this.sleep(1000);
                
                const success = await this.verifyTransmissionSuccess(inputEl);
                if (success) {
                    debugLog('gemini', `Enter method ${i + 1} successful`);
                    return { success: true };
                }
            } catch (error) {
                debugLog('gemini', `Enter method ${i + 1} failed:`, error.message);
            }
        }
        
        return { 
            success: false, 
            warning: 'Enter 키 전송 방법들이 실패했습니다' 
        };
    }

    async simpleEnter(inputEl) {
        inputEl.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            bubbles: true,
            cancelable: true
        }));
    }

    async ctrlEnter(inputEl) {
        inputEl.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter',
            ctrlKey: true,
            bubbles: true,
            cancelable: true
        }));
    }

    async shiftEnter(inputEl) {
        inputEl.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter',
            shiftKey: true,
            bubbles: true,
            cancelable: true
        }));
    }

    async verifyTransmissionSuccess(inputEl) {
        debugLog('gemini', 'Verifying transmission success');
        
        // Gemini 특화 성공 지표
        const successIndicators = [
            // 1. 로딩/생성 상태 확인
            () => document.querySelector('.loading, .generating'),
            () => document.querySelector('[data-testid="loading"]'),
            () => document.querySelector('.animate-pulse'),
            
            // 2. 전송 버튼 비활성화 확인
            () => {
                const sendBtn = this.findElement(this.getSelectors().sendButton);
                return sendBtn && sendBtn.disabled;
            },
            
            // 3. 입력창 비워짐 확인
            () => {
                const currentText = this.getInputValue(inputEl);
                return currentText.trim() === '';
            },
            
            // 4. 새로운 대화 컨테이너 생성 확인
            () => document.querySelector('.conversation-container:last-child .loading'),
            () => document.querySelector('model-response[data-response-index]'),
            
            // 5. 검색 진행 상태 확인 (Gemini 특화)
            () => document.querySelector('.search-progress'),
            () => document.querySelector('[data-testid="generating"]')
        ];
        
        // 하나라도 성공 지표가 감지되면 성공
        for (const indicator of successIndicators) {
            try {
                if (indicator()) {
                    debugLog('gemini', 'Transmission success indicator detected');
                    return true;
                }
            } catch (error) {
                // 개별 지표 확인 실패는 무시
            }
        }
        
        return false;
    }

    getInputValue(inputEl) {
        if (inputEl.tagName.toLowerCase() === 'rich-textarea') {
            return this.getRichTextareaValue(inputEl);
        } else if (inputEl.tagName.toLowerCase() === 'textarea') {
            return inputEl.value || '';
        } else {
            return inputEl.textContent || inputEl.innerText || '';
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Multi-Chat 기능: 응답 수집
    // ─────────────────────────────────────────────────────────────────────────────

    async getLatestResponse() {
        try {
            if (!this.extensionEnabled) {
                return { 
                    responseText: null, 
                    error: '확장 프로그램이 비활성화되어 있습니다.',
                    site: this.siteName 
                };
            }

            // 응답 완료 대기
            await this.waitForResponse();
            
            // 응답 요소들 찾기
            const responseElements = this.findElements(this.getSelectors().responseContainer);
            if (responseElements.length === 0) {
                debugLog('gemini', 'No response elements found');
                return { responseText: null };
            }
            
            // 가장 최근 응답 선택 (data-response-index 기준)
            let latestResponse = responseElements[responseElements.length - 1];
            let maxIndex = -1;
            
            responseElements.forEach(elem => {
                const responseIndex = elem.getAttribute('data-response-index');
                if (responseIndex && parseInt(responseIndex) > maxIndex) {
                    maxIndex = parseInt(responseIndex);
                    latestResponse = elem;
                }
            });
            
            const responseText = this.extractGeminiResponse(latestResponse);
            
            debugLog('gemini', 'Response extracted', {
                elementCount: responseElements.length,
                responseIndex: maxIndex,
                responseLength: responseText.length
            });
            
            return { 
                responseText: responseText.trim(), 
                site: this.siteName,
                extensionEnabled: this.extensionEnabled
            };
        } catch (error) {
            debugLog('gemini', 'Get latest response error:', error);
            return { 
                responseText: null, 
                error: error.message, 
                site: this.siteName,
                extensionEnabled: this.extensionEnabled
            };
        }
    }

    extractGeminiResponse(responseElement) {
        if (!responseElement) return '';
        
        // Gemini의 특화된 응답 구조 처리
        const responseTextElement = responseElement.querySelector('.model-response-text');
        if (responseTextElement) {
            return extractTextFromElement(responseTextElement);
        }
        
        // 마크다운 컨테이너 확인
        const markdownElement = responseElement.querySelector('.markdown, [class*="markdown"]');
        if (markdownElement) {
            return extractTextFromElement(markdownElement);
        }
        
        // 일반적인 텍스트 추출
        return extractTextFromElement(responseElement);
    }

    async waitForResponse(timeout = 45000) {
        debugLog('gemini', 'Waiting for response');
        
        const startTime = Date.now();
        let sawLoading = false;
        
        while (Date.now() - startTime < timeout) {
            // Gemini의 생성/검색 상태 확인
            const loadingEl = this.findElement(this.getSelectors().loadingIndicator);
            const generatingEl = document.querySelector('.generating, [data-testid="loading"]');
            const searchingEl = document.querySelector('.search-progress');
            
            if (loadingEl || generatingEl || searchingEl) {
                if (!sawLoading) {
                    debugLog('gemini', 'Response generation started');
                }
                sawLoading = true;
            } else if (sawLoading) {
                // 생성이 끝났으면 조금 더 대기
                debugLog('gemini', 'Response generation completed');
                await this.sleep(3000); // Gemini는 더 긴 대기 시간
                return;
            }
            
            await this.sleep(this.searchCheckInterval);
        }
        
        if (!sawLoading) {
            debugLog('gemini', 'No loading state detected, assuming response is ready');
            return;
        }
        
        throw new Error('Gemini 응답 대기 시간 초과');
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // MD Export 기능: 대화 데이터 추출
    // ─────────────────────────────────────────────────────────────────────────────

    getConversationData() {
        debugLog('gemini', 'Getting conversation data');
        
        const title = this.extractTitle();
        const conversationData = this.analyzeGeminiConversation();

        const result = {
            title: title,
            userMessages: conversationData.userCount,
            assistantMessages: conversationData.geminiCount,
            totalMessages: conversationData.userCount + conversationData.geminiCount,
            serviceName: this.siteName,
            detectionMethod: conversationData.method,
            timestamp: new Date().toISOString()
        };

        debugLog('gemini', 'Conversation data extracted', result);
        return result;
    }

    analyzeGeminiConversation() {
        // 방법 1: conversation-container 기반
        const conversationContainers = document.querySelectorAll('.conversation-container');
        if (conversationContainers.length > 0) {
            let userCount = 0, geminiCount = 0;
            
            conversationContainers.forEach(container => {
                if (container.querySelector('user-query')) userCount++;
                if (container.querySelector('model-response')) geminiCount++;
            });
            
            if (userCount > 0 || geminiCount > 0) {
                return { userCount, geminiCount, method: 'conversation-container' };
            }
        }

        // 방법 2: user-query와 model-response 직접 카운트
        const userQueries = document.querySelectorAll('user-query');
        const modelResponses = document.querySelectorAll('model-response');
        
        if (userQueries.length > 0 || modelResponses.length > 0) {
            return { 
                userCount: userQueries.length,
                geminiCount: modelResponses.length,
                method: 'direct-query-response'
            };
        }

        // 방법 3: data-message-author-role 기반 (백업)
        let userCount = 0, geminiCount = 0;
        document.querySelectorAll('[data-message-author-role]').forEach(msg => {
            const role = msg.getAttribute('data-message-author-role');
            if (role === 'user') userCount++;
            if (role === 'assistant' || role === 'model') geminiCount++;
        });

        if (userCount > 0 || geminiCount > 0) {
            return { userCount, geminiCount, method: 'message-role' };
        }

        // 방법 4: 일반적인 메시지 구조 분석 (최종 백업)
        const allMessages = document.querySelectorAll('.message, [class*="message"]');
        allMessages.forEach(msg => {
            const classes = msg.className.toLowerCase();
            if (classes.includes('user') || classes.includes('human')) {
                userCount++;
            } else if (classes.includes('gemini') || classes.includes('assistant') || classes.includes('model')) {
                geminiCount++;
            }
        });

        return { userCount, geminiCount, method: 'fallback-analysis' };
    }

    extractTitle() {
        debugLog('gemini', 'Extracting title');
        
        const titleSources = [
            // 방법 1: 첫 번째 질문을 제목으로 사용
            () => {
                const firstUserQuery = document.querySelector('user-query');
                if (firstUserQuery) {
                    const queryText = this.extractUserMessage(firstUserQuery);
                    if (queryText && queryText.length > 10) {
                        // 첫 줄 또는 첫 문장을 제목으로 사용
                        const firstLine = queryText.split(/[.\n!?]/)[0];
                        return firstLine.length > 100 ? firstLine.substring(0, 100) + '...' : firstLine;
                    }
                }
            },
            
            // 방법 2: 선택된 대화 제목
            () => {
                const selectedConv = document.querySelector('.conversation.selected .conversation-title');
                return selectedConv?.textContent?.trim();
            },
            
            // 방법 3: 활성 대화 제목
            () => {
                const activeConv = document.querySelector('[class*="conversation"][class*="selected"] .conversation-title');
                return activeConv?.textContent?.trim();
            },
            
            // 방법 4: 일반 대화 제목
            () => {
                const convTitle = document.querySelector('.conversation-title');
                return convTitle?.textContent?.trim();
            },
            
            // 방법 5: 페이지 제목에서 추출
            () => {
                const pageTitle = document.querySelector('title');
                if (pageTitle && pageTitle.textContent) {
                    let title = pageTitle.textContent.trim();
                    title = title.replace(/Gemini\s*[-|]?\s*/gi, '')
                                .replace(/\s*[-|]?\s*Gemini/gi, '')
                                .replace(/Google\s*[-|]?\s*/gi, '')
                                .replace(/\s*[-|]?\s*Google/gi, '')
                                .trim();
                    if (title && title.length > 5) {
                        return title;
                    }
                }
            },
            
            // 방법 6: 메타 태그
            () => {
                const metaTitle = document.querySelector('meta[property="og:title"]');
                if (metaTitle) {
                    const title = metaTitle.getAttribute('content');
                    if (title && !title.includes('Gemini') && !title.includes('Google')) {
                        return title;
                    }
                }
            },
            
            // 방법 7: URL 파라미터에서 추출
            () => {
                const searchParams = new URLSearchParams(window.location.search);
                const q = searchParams.get('q');
                if (q) {
                    return decodeURIComponent(q);
                }
            }
        ];

        for (const source of titleSources) {
            try {
                const title = source();
                if (title && title.length > 0 && title !== 'Gemini' && title !== 'Google') {
                    debugLog('gemini', 'Title found:', title);
                    return title;
                }
            } catch (error) {
                debugLog('gemini', 'Title extraction error:', error);
            }
        }

        return 'Gemini 대화';
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // MD Export 기능: 마크다운 생성
    // ─────────────────────────────────────────────────────────────────────────────

    generateMarkdown(includeUser, includeAssistant) {
        debugLog('gemini', 'Generating markdown', { includeUser, includeAssistant });
        
        let markdown = '';
        
        // 방법 1: conversation-container 기반 처리
        const conversationContainers = document.querySelectorAll('.conversation-container');
        
        if (conversationContainers.length > 0) {
            markdown = this.generateMarkdownFromContainers(conversationContainers, includeUser, includeAssistant);
        } else {
            // 방법 2: 직접 요소 기반 처리
            markdown = this.generateMarkdownFromElements(includeUser, includeAssistant);
        }

        if (!markdown.trim()) {
            markdown = this.generateMarkdownFallback(includeUser, includeAssistant);
        }

        debugLog('gemini', 'Markdown generated', { length: markdown.length });
        return markdown || '대화 내용을 추출할 수 없습니다.';
    }

    generateMarkdownFromContainers(containers, includeUser, includeAssistant) {
        debugLog('gemini', 'Generating markdown from conversation containers');
        
        let markdown = '';
        
        containers.forEach((container, containerIndex) => {
            const userQuery = container.querySelector('user-query');
            const modelResponse = container.querySelector('model-response');

            if (userQuery && includeUser) {
                const userText = this.extractUserMessage(userQuery);
                if (userText.trim()) {
                    const questionNumber = containers.length > 1 ? ` ${containerIndex + 1}` : '';
                    markdown += `## 👤 사용자${questionNumber}\n\n${userText}\n\n`;
                }
            }

            if (modelResponse && includeAssistant) {
                const geminiText = this.extractAssistantMessage(modelResponse);
                if (geminiText.trim()) {
                    const responseNumber = containers.length > 1 ? ` ${containerIndex + 1}` : '';
                    markdown += `## ${this.serviceEmoji} ${this.siteName}${responseNumber}\n\n${geminiText}\n\n`;
                }
            }

            if (containerIndex < containers.length - 1 && (userQuery || modelResponse)) {
                markdown += '---\n\n';
            }
        });
        
        return markdown;
    }

    generateMarkdownFromElements(includeUser, includeAssistant) {
        debugLog('gemini', 'Generating markdown from direct elements');
        
        let markdown = '';
        const allElements = [];
        
        // 사용자 질문 수집
        document.querySelectorAll('user-query').forEach(uq => {
            allElements.push({ type: 'user', element: uq });
        });
        
        // 모델 응답 수집
        document.querySelectorAll('model-response').forEach(mr => {
            allElements.push({ type: 'assistant', element: mr });
        });
        
        // data-message-author-role 기반 폴백
        if (allElements.length === 0) {
            document.querySelectorAll('[data-message-author-role]').forEach(msg => {
                const role = msg.getAttribute('data-message-author-role');
                if (role === 'user') {
                    allElements.push({ type: 'user', element: msg });
                } else if (role === 'assistant' || role === 'model') {
                    allElements.push({ type: 'assistant', element: msg });
                }
            });
        }
        
        // DOM 순서대로 정렬
        allElements.sort((a, b) => {
            return a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
        });

        allElements.forEach((item, index) => {
            if (item.type === 'user' && includeUser) {
                const userText = this.extractUserMessage(item.element);
                if (userText.trim()) {
                    markdown += `## 👤 사용자\n\n${userText}\n\n`;
                }
            }
            
            if (item.type === 'assistant' && includeAssistant) {
                const assistantText = this.extractAssistantMessage(item.element);
                if (assistantText.trim()) {
                    markdown += `## ${this.serviceEmoji} ${this.siteName}\n\n${assistantText}\n\n`;
                }
            }
            
            if (index < allElements.length - 1) {
                markdown += '---\n\n';
            }
        });

        return markdown;
    }

    generateMarkdownFallback(includeUser, includeAssistant) {
        debugLog('gemini', 'Using fallback markdown generation');
        
        let markdown = '';
        
        // 일반적인 메시지 구조로 시도
        const allMessages = document.querySelectorAll(
            '.message, [class*="message"], [data-testid*="message"]'
        );
        
        allMessages.forEach((msg, index) => {
            const classes = msg.className.toLowerCase();
            const testId = msg.getAttribute('data-testid') || '';
            
            const isUserMessage = classes.includes('user') || 
                                testId.includes('user') || 
                                msg.querySelector('user-query');
            
            const isAssistantMessage = classes.includes('gemini') || 
                                     classes.includes('assistant') || 
                                     classes.includes('model') ||
                                     testId.includes('assistant') ||
                                     msg.querySelector('model-response');
            
            if (isUserMessage && includeUser) {
                const text = extractTextFromElement(msg);
                if (text.trim()) {
                    markdown += `## 👤 사용자\n\n${text}\n\n`;
                }
            } else if (isAssistantMessage && includeAssistant) {
                const text = this.extractAssistantMessage(msg);
                if (text.trim()) {
                    markdown += `## ${this.serviceEmoji} ${this.siteName}\n\n${text}\n\n`;
                }
            }
            
            if (index < allMessages.length - 1) {
                markdown += '---\n\n';
            }
        });
        
        return markdown;
    }

    extractUserMessage(userQuery) {
        if (!userQuery) return '';
        
        // Gemini 사용자 쿼리 구조 분석
        const queryContent = userQuery.querySelector('user-query-content');
        if (queryContent) {
            const queryText = queryContent.querySelector('.query-text');
            if (queryText) {
                let userText = '';
                const paragraphs = queryText.querySelectorAll('p');
                paragraphs.forEach(p => {
                    const text = p.textContent.trim();
                    if (text && text !== '<!---->') {
                        userText += text + '\n\n';
                    }
                });
                return userText.trim();
            }
        }
        
        // 폴백: 직접 텍스트 추출
        return extractTextFromElement(userQuery);
    }

    extractAssistantMessage(modelResponse) {
        if (!modelResponse) return '';
        
        debugLog('gemini', 'Extracting assistant message');
        
        let content = '';

        // 방법 1: message-content 기반
        const messageContent = modelResponse.querySelector('message-content');
        if (messageContent) {
            const markdownDiv = messageContent.querySelector('div.markdown');
            if (markdownDiv) {
                content = this.extractGeminiMarkdownContent(markdownDiv);
            } else {
                content = extractTextFromElement(messageContent);
            }
        } else {
            // 방법 2: 직접 마크다운 컨테이너 찾기
            const markdownContainer = modelResponse.querySelector('.markdown, [class*="markdown"]');
            if (markdownContainer) {
                content = this.extractGeminiMarkdownContent(markdownContainer);
            } else {
                // 방법 3: 일반 텍스트 추출
                content = extractTextFromElement(modelResponse);
            }
        }

        return content.trim();
    }

    extractGeminiMarkdownContent(markdownContainer) {
        debugLog('gemini', 'Extracting Gemini markdown content');
        
        let markdown = '';
        
        // Gemini의 마크다운 구조를 직접 순회
        const directChildren = Array.from(markdownContainer.children);
        
        directChildren.forEach(child => {
            const tagName = child.tagName.toLowerCase();
            
            switch (tagName) {
                case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
                    const level = parseInt(tagName.charAt(1));
                    const headingText = child.textContent.trim();
                    if (headingText) {
                        markdown += `${'#'.repeat(level)} ${headingText}\n\n`;
                    }
                    break;
                    
                case 'p':
                    const pText = child.textContent.trim();
                    if (pText && pText !== '<!---->') {
                        // 링크 처리
                        const processedText = this.processGeminiParagraph(child);
                        markdown += `${processedText}\n\n`;
                    }
                    break;
                    
                case 'ol':
                    const olItems = child.querySelectorAll('li');
                    olItems.forEach((li, liIndex) => {
                        const liText = li.textContent.trim();
                        if (liText) {
                            markdown += `${liIndex + 1}. ${liText}\n`;
                        }
                    });
                    if (olItems.length > 0) markdown += '\n';
                    break;
                    
                case 'ul':
                    const ulItems = child.querySelectorAll('li');
                    ulItems.forEach(li => {
                        const liText = li.textContent.trim();
                        if (liText) {
                            markdown += `- ${liText}\n`;
                        }
                    });
                    if (ulItems.length > 0) markdown += '\n';
                    break;
                    
                case 'table':
                    const tableMarkdown = extractTableMarkdown(child);
                    if (tableMarkdown) {
                        markdown += `${tableMarkdown}\n\n`;
                    }
                    break;
                    
                case 'pre':
                    const code = child.querySelector('code');
                    if (code) {
                        const language = code.className.match(/language-(\w+)/)?.[1] || '';
                        markdown += `\`\`\`${language}\n${code.textContent}\n\`\`\`\n\n`;
                    } else {
                        markdown += `\`\`\`\n${child.textContent.trim()}\n\`\`\`\n\n`;
                    }
                    break;
                    
                case 'blockquote':
                    child.textContent.split('\n').forEach(line => {
                        if (line.trim()) {
                            markdown += `> ${line.trim()}\n`;
                        }
                    });
                    markdown += '\n';
                    break;
                    
                default:
                    const elementText = child.textContent.trim();
                    if (elementText && elementText !== '<!---->') {
                        markdown += `${elementText}\n\n`;
                    }
                    break;
            }
        });

        // 너무 짧으면 폴백 사용
        if (markdown.trim().length < 50) {
            return extractTextFromElement(markdownContainer);
        }

        return markdown.trim();
    }

    processGeminiParagraph(paragraph) {
        let text = '';
        
        // 텍스트 노드와 링크를 순서대로 처리
        const walker = document.createTreeWalker(
            paragraph,
            NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
            null,
            false
        );
        
        let node;
        while (node = walker.nextNode()) {
            if (node.nodeType === Node.TEXT_NODE) {
                text += node.textContent;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.tagName.toLowerCase() === 'a') {
                    const href = node.getAttribute('href');
                    const linkText = node.textContent.trim();
                    if (href && linkText) {
                        text += `[${linkText}](${href})`;
                    } else {
                        text += linkText;
                    }
                } else if (node.tagName.toLowerCase() === 'strong') {
                    text += `**${node.textContent}**`;
                } else if (node.tagName.toLowerCase() === 'em') {
                    text += `*${node.textContent}*`;
                } else if (node.tagName.toLowerCase() === 'code') {
                    text += `\`${node.textContent}\``;
                }
            }
        }
        
        return text.trim();
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Gemini 특화 초기화 및 관찰자
    // ─────────────────────────────────────────────────────────────────────────────

    initialize() {
        debugLog('gemini', 'Gemini interface initializing');
        
        // Gemini 특화 초기화
        this.setupGeminiObserver();
        this.detectGeminiUI();
        this.monitorGeminiState();
        
        debugLog('gemini', 'Gemini interface initialization complete');
    }

    setupGeminiObserver() {
        // Gemini의 대화 변화를 감지하는 옵저버
        const geminiObserver = new MutationObserver(debounce(() => {
            const conversations = document.querySelectorAll('.conversation-container');
            const userQueries = document.querySelectorAll('user-query');
            const modelResponses = document.querySelectorAll('model-response');
            
            debugLog('gemini', 'Gemini content change detected', {
                conversations: conversations.length,
                userQueries: userQueries.length,
                modelResponses: modelResponses.length,
                isGenerating: !!document.querySelector('.generating, [data-testid="loading"]')
            });
        }, 1000));

        geminiObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-response-index', 'data-testid', 'class']
        });

        this.geminiObserver = geminiObserver;
        debugLog('gemini', 'Gemini observer setup complete');
    }

    detectGeminiUI() {
        const uiElements = {
            conversationContainers: document.querySelectorAll('.conversation-container').length,
            userQueries: document.querySelectorAll('user-query').length,
            modelResponses: document.querySelectorAll('model-response').length,
            messageContents: document.querySelectorAll('message-content').length,
            markdownDivs: document.querySelectorAll('div.markdown').length,
            richTextareas: document.querySelectorAll('rich-textarea').length,
            inputElements: document.querySelectorAll('textarea, [contenteditable="true"]').length,
            sendButtons: document.querySelectorAll('button[aria-label*="Submit"], button[data-testid*="send"]').length
        };
        
        debugLog('gemini', 'Gemini UI elements detected', uiElements);
        
        // Gemini의 특별한 요소들 감지
        const specialElements = {
            chatInput: document.querySelector('[data-testid="chat-input"]') !== null,
            promptTextarea: document.querySelector('[aria-label*="Enter a prompt"]') !== null,
            submitButton: document.querySelector('[aria-label*="Submit"]') !== null,
            conversationList: document.querySelector('.conversation-list') !== null,
            searchProgress: document.querySelector('.search-progress') !== null
        };
        
        debugLog('gemini', 'Special UI elements', specialElements);
        
        return { ...uiElements, ...specialElements };
    }

    monitorGeminiState() {
        // Gemini의 상태를 주기적으로 모니터링
        this.stateMonitor = setInterval(() => {
            const state = {
                isGenerating: !!document.querySelector('.generating, [data-testid="loading"]'),
                isSearching: !!document.querySelector('.search-progress'),
                inputAvailable: !!this.findElement(this.getSelectors().messageInput),
                sendButtonAvailable: !!this.findElement(this.getSelectors().sendButton),
                conversationCount: document.querySelectorAll('.conversation-container').length,
                responseCount: document.querySelectorAll('model-response').length,
                url: window.location.href,
                extensionEnabled: this.extensionEnabled
            };
            
            // 상태 변화가 있을 때만 로그
            if (JSON.stringify(state) !== JSON.stringify(this.lastState)) {
                debugLog('gemini', 'Gemini state changed', state);
                this.lastState = state;
            }
        }, 5000);
    }

    checkForRelevantChanges() {
        // Gemini 특화 변화 감지
        const relevantSelectors = [
            'rich-textarea', 'textarea', '[contenteditable="true"]',
            'button[aria-label*="Submit"]', '[data-testid="send-button"]',
            '.conversation-container', 'user-query', 'model-response',
            'message-content', '.markdown', '.generating'
        ];

        return relevantSelectors.some(selector => {
            try {
                return document.querySelector(selector) !== null;
            } catch {
                return false;
            }
        });
    }

    destroy() {
        super.destroy();
        
        if (this.geminiObserver) {
            this.geminiObserver.disconnect();
            this.geminiObserver = null;
        }
        
        if (this.stateMonitor) {
            clearInterval(this.stateMonitor);
            this.stateMonitor = null;
        }
        
        debugLog('gemini', 'Gemini interface destroyed');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Gemini 서비스 모듈 등록
// ─────────────────────────────────────────────────────────────────────────────

// 안전한 초기화 함수
function initializeGeminiInterface() {
    // content_common.js 로드 대기
    const maxWaitTime = 10000; // 10초
    const startTime = Date.now();
    
    function attemptInit() {
        if (Date.now() - startTime > maxWaitTime) {
            console.error('[Universal AI Assistant] Gemini: content_common.js 로드 시간 초과');
            return;
        }
        
        if (!window.UniversalAIAssistant || !window.UniversalAIAssistant.BaseAISiteInterface) {
            debugLog('gemini', 'Common module not ready, waiting...');
            setTimeout(attemptInit, 500);
            return;
        }

        // 기존 인터페이스 정리
        if (window.aiServiceModule) {
            debugLog('gemini', 'Cleaning up existing interface');
            try {
                if (typeof window.aiServiceModule.destroy === 'function') {
                    window.aiServiceModule.destroy();
                }
            } catch (error) {
                debugLog('gemini', 'Error during cleanup:', error);
            }
            window.aiServiceModule = null;
        }

        try {
            debugLog('gemini', 'Creating new Gemini interface');
            window.aiServiceModule = new GeminiInterface();
            debugLog('gemini', 'Gemini interface created successfully');
        } catch (error) {
            console.error('[Universal AI Assistant] Gemini 초기화 실패:', error);
            // 재시도
            setTimeout(initializeGeminiInterface, 2000);
        }
    }
    
    attemptInit();
}

// DOM 상태에 따른 초기화
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGeminiInterface);
} else {
    // 약간의 지연을 두고 초기화 (content_common.js 로드 시간 확보)
    setTimeout(initializeGeminiInterface, 100);
}

// 추가 안전장치
window.addEventListener('load', () => {
    setTimeout(initializeGeminiInterface, 1000);
});

// URL 변경 감지 (SPA 대응)
let lastURL = location.href;
const urlObserver = new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastURL) {
        lastURL = currentUrl;
        debugLog('gemini', 'URL changed, reinitializing:', currentUrl);
        
        if (window.aiServiceModule) {
            try {
                if (typeof window.aiServiceModule.destroy === 'function') {
                    window.aiServiceModule.destroy();
                }
            } catch (error) {
                debugLog('gemini', 'Error during URL change cleanup:', error);
            }
            window.aiServiceModule = null;
        }
        
        setTimeout(initializeGeminiInterface, 2000);
    }
});

urlObserver.observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['data-pathname', 'data-route']
});

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
    if (window.aiServiceModule && typeof window.aiServiceModule.destroy === 'function') {
        try {
            window.aiServiceModule.destroy();
        } catch (error) {
            debugLog('gemini', 'Error during beforeunload cleanup:', error);
        }
    }
    
    if (urlObserver) {
        urlObserver.disconnect();
    }
});

// Gemini 전용 디버그 함수
window.debugGemini = function() {
    if (window.aiServiceModule && window.aiServiceModule.siteName === 'Gemini') {
        console.log('=== Gemini Debug ===');
        console.log('Service module:', window.aiServiceModule);
        console.log('UI detection:', window.aiServiceModule.detectGeminiUI());
        console.log('Connection status:', window.aiServiceModule.checkConnection());
        console.log('Conversation data:', window.aiServiceModule.getConversationData());
        
        try {
            const markdown = window.aiServiceModule.generateMarkdown(true, true);
            console.log('Generated markdown preview:', markdown.substring(0, 500) + '...');
        } catch (error) {
            console.log('Markdown generation error:', error);
        }
    } else {
        console.log('Gemini module not loaded or not on Gemini page');
    }
};

// 디버그 로그 헬퍼 (common에서 가져오기)
function debugLog(category, message, data = null) {
    if (window.UniversalAIAssistant?.utils?.debugLog) {
        window.UniversalAIAssistant.utils.debugLog(category, message, data);
    } else {
        // 폴백
        const timestamp = new Date().toISOString();
        const logMessage = `[Universal AI Assistant] [${timestamp}] [${category.toUpperCase()}] ${message}`;
        if (data) {
            console.log(logMessage, data);
        } else {
            console.log(logMessage);
        }
    }
}

// 디바운스 함수 (common에서 가져오기)
function debounce(func, wait) {
    if (window.UniversalAIAssistant?.utils?.debounce) {
        return window.UniversalAIAssistant.utils.debounce(func, wait);
    } else {
        // 폴백
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// 텍스트 추출 함수 (common에서 가져오기)
function extractTextFromElement(element) {
    if (window.UniversalAIAssistant?.utils?.extractTextFromElement) {
        return window.UniversalAIAssistant.utils.extractTextFromElement(element);
    } else {
        // 폴백
        return element ? element.textContent || element.innerText || '' : '';
    }
}

// 테이블 마크다운 추출 함수 (common에서 가져오기)
function extractTableMarkdown(tableElement) {
    if (window.UniversalAIAssistant?.utils?.extractTableMarkdown) {
        return window.UniversalAIAssistant.utils.extractTableMarkdown(tableElement);
    } else {
        // 폴백
        return '';
    }
}

console.log('💎 Universal AI Assistant - Gemini Service Module 로드 완료');