// ─────────────────────────────────────────────────────────────────────────────
// Universal AI Assistant - Claude Service Module (content_claude.js)
// Multi-Chat + MD Export 통합 기능 제공 - 버그 수정된 버전
// ─────────────────────────────────────────────────────────────────────────────

// Claude 전용 인터페이스 클래스
class ClaudeInterface extends window.UniversalAIAssistant.BaseAISiteInterface {
    constructor() {
        super('Claude');
        this.serviceEmoji = '🧠';
        this.serviceColor = '#d97706';
        
        // Claude 특화 설정
        this.maxRetries = 3;
        this.defaultTimeout = 30000;
        this.streamingCheckInterval = 1000;
        
        debugLog('claude', 'Claude interface initialized');
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Claude 선택자 정의 (기존 안정적인 선택자 우선)
    // ─────────────────────────────────────────────────────────────────────────────

    getSelectors() {
        return {
            messageInput: [
                'div[contenteditable="true"].ProseMirror',
                'fieldset div[contenteditable="true"]',
                '[data-testid="chat-input"]',
                'div[contenteditable="true"]',
                'textarea[placeholder*="Talk with Claude"]',
                'div[role="textbox"]',
                '.composer-input',
                'div.ProseMirror[data-gramm="false"]',
                'div[contenteditable="true"][data-placeholder]',
                'div[data-gramm_editor="false"][contenteditable="true"]'
            ],
            sendButton: [
                'button[aria-label*="Send Message"]',
                'button[data-testid="send-button"]',
                'button:has(svg[data-icon="send"])',
                'button[type="submit"]:not([disabled])',
                'button[aria-label*="Submit"]',
                'button:has(svg):not([disabled])',
                'form button:last-child:not([disabled])',
                'button[aria-label="Send"]',
                'button:has(svg[viewBox="0 0 24 24"]):not([disabled])',
                'button[class*="send"]:not([disabled])',
                'div[role="button"]:has(svg):not([disabled])'
            ],
            responseContainer: [
                '[data-testid="message-content"]',
                '.prose:not([data-is-streaming="true"])',
                '.font-claude-message',
                '[data-testid="conversation-turn"] .prose',
                '.message-content',
                '.response-content',
                '[role="presentation"] .prose',
                'div[data-testid="conversation-turn-3"]',
                '[data-test-render-count]'
            ],
            loadingIndicator: [
                '[data-is-streaming="true"]',
                '.loading-response',
                '.thinking',
                '.animate-pulse',
                '.generating',
                '[data-testid="stop-button"]',
                'button[aria-label="Stop"]',
                '.prose[data-is-streaming="true"]',
                '[data-testid="loading"]',
                '.spinner'
            ],
            conversationContainer: [
                '[data-test-render-count]',
                '.conversation-turn',
                '[data-testid="conversation-turn"]',
                '.message-block',
                '.chat-message'
            ]
        };
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Multi-Chat 기능: 연결 확인
    // ─────────────────────────────────────────────────────────────────────────────

    async checkConnection() {
        try {
            if (!this.extensionEnabled) {
                debugLog('claude', 'Extension disabled, returning false');
                return false;
            }

            // 입력창 확인
            const inputEl = this.findElement(this.getSelectors().messageInput);
            
            // 로그인 상태 확인 (기존 방식 사용)
            const isLoggedIn = !document.querySelector('.auth-wall, .login-form, [data-testid="login-button"], .sign-in');
            
            const isConnected = !!inputEl && isLoggedIn;
            
            console.log('[MultiAI] Claude checkConnection:', {
                inputFound: !!inputEl,
                isLoggedIn: isLoggedIn,
                connected: isConnected
            });
            
            return isConnected;
        } catch (error) {
            console.log('[MultiAI] Claude checkConnection 오류:', error);
            return false;
        }
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
                    error: 'Claude 메시지 입력창을 찾을 수 없습니다' 
                };
            }
            
            if (!sendBtn) {
                return { 
                    success: false, 
                    error: 'Claude 전송 버튼을 찾을 수 없습니다' 
                };
            }
            
            // 입력창 포커스 테스트
            inputEl.focus();
            await this.sleep(100);
            
            return {
                success: true,
                message: 'Claude 연결 테스트 성공',
                details: {
                    site: this.siteName,
                    inputTag: inputEl.tagName.toLowerCase(),
                    inputClass: inputEl.className,
                    buttonFound: true,
                    url: window.location.href,
                    extensionEnabled: this.extensionEnabled
                }
            };
        } catch (error) {
            console.log('[MultiAI] Claude testConnection 오류:', error);
            return { 
                success: false, 
                error: error.message 
            };
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Multi-Chat 기능: 메시지 전송 (기존 안정적인 방식 사용)
    // ─────────────────────────────────────────────────────────────────────────────

    async sendMessage(message) {
        try {
            if (!this.extensionEnabled) {
                console.log('[MultiAI] Claude sendMessage 차단: 확장 프로그램이 비활성화됨');
                return { 
                    success: false, 
                    error: '확장 프로그램이 비활성화되어 있습니다.',
                    site: this.siteName,
                    extensionDisabled: true
                };
            }

            if (this.isSending) {
                console.log('[MultiAI] Claude sendMessage 호출 중복 방지: 이미 전송 중입니다.');
                return { 
                    success: false, 
                    error: '전송 대기 중입니다.' 
                };
            }

            this.isSending = true;
            console.log(`[MultiAI] Claude에 메시지 전송 시도:`, message);

            // 메시지 입력창 찾기
            const inputEl = this.findElement(this.getSelectors().messageInput);
            if (!inputEl) {
                throw new Error('Claude 메시지 입력창을 찾을 수 없습니다.');
            }

            console.log('[MultiAI] Claude 입력창 정보:', {
                tagName: inputEl.tagName,
                className: inputEl.className,
                contentEditable: inputEl.contentEditable,
                isProseMirror: inputEl.classList.contains('ProseMirror')
            });
            
            // 입력창 포커스
            inputEl.focus();
            await this.sleep(300);

            // Claude ProseMirror 특화 입력 처리 (기존 안정적인 방식)
            let inputSuccess = false;
            
            if (inputEl.classList.contains('ProseMirror') || inputEl.contentEditable === 'true') {
                try {
                    // 방법 1: ProseMirror 전용 입력 (기존 방식)
                    console.log('[MultiAI] Claude ProseMirror 방식으로 입력 시도');
                    
                    // 기존 내용 완전히 지우기
                    inputEl.innerHTML = '';
                    inputEl.textContent = '';
                    await this.sleep(100);
                    
                    // 새 p 태그 생성하여 메시지 입력
                    const p = document.createElement('p');
                    p.textContent = message;
                    inputEl.appendChild(p);
                    
                    // 커서를 끝으로 이동
                    const range = document.createRange();
                    const sel = window.getSelection();
                    range.selectNodeContents(p);
                    range.collapse(false);
                    sel.removeAllRanges();
                    sel.addRange(range);
                    
                    // 다양한 이벤트 발생
                    const events = ['input', 'compositionend', 'keyup', 'change'];
                    events.forEach(eventType => {
                        inputEl.dispatchEvent(new Event(eventType, { bubbles: true }));
                    });
                    
                    // React 스타일 이벤트도 추가
                    const reactEvt = new Event('input', { bubbles: true });
                    reactEvt.simulated = true;
                    inputEl.dispatchEvent(reactEvt);
                    
                    await this.sleep(500);
                    
                    // 입력 검증
                    const currentText = inputEl.textContent || inputEl.innerText || '';
                    if (currentText.includes(message.substring(0, 10))) {
                        inputSuccess = true;
                        console.log('[MultiAI] Claude ProseMirror 입력 성공');
                    }
                } catch (e) {
                    console.log('[MultiAI] Claude ProseMirror 방식 실패:', e.message);
                }
                
                // 방법 2: 백업 방식 - 직접 텍스트 입력
                if (!inputSuccess) {
                    try {
                        console.log('[MultiAI] Claude 직접 텍스트 입력 방식 시도');
                        inputEl.focus();
                        await this.sleep(200);
                        
                        // 전체 선택 후 삭제
                        inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }));
                        await this.sleep(100);
                        
                        // 직접 텍스트 설정
                        inputEl.textContent = message;
                        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                        
                        await this.sleep(300);
                        inputSuccess = true;
                        console.log('[MultiAI] Claude 직접 텍스트 입력 성공');
                    } catch (e) {
                        console.log('[MultiAI] Claude 직접 텍스트 입력 실패:', e.message);
                    }
                }
            } else {
                // 일반 textarea 처리 (fallback)
                try {
                    await this.inputHandler.typeMessageRobust(inputEl, message);
                    inputSuccess = true;
                } catch (e) {
                    console.log('[MultiAI] Claude 일반 입력 방식 실패:', e.message);
                }
            }

            if (!inputSuccess) {
                throw new Error('모든 입력 방식이 실패했습니다.');
            }

            await this.sleep(1000);

            // 전송 시도 (기존 안정적인 방식 사용)
            let sendSuccess = false;
            const sendBtn = this.findElement(this.getSelectors().sendButton);
            
            // 전송 전 초기 상태 확인
            const initialInputText = inputEl.textContent || inputEl.innerText || '';
            
            if (sendBtn) {
                console.log('[MultiAI] Claude 전송 버튼 발견, 클릭 시도');
                
                try {
                    // 버튼이 활성화될 때까지 대기 (최대 5초)
                    let attempts = 0;
                    while (sendBtn.disabled && attempts < 25) {
                        await this.sleep(200);
                        attempts++;
                    }
                    
                    if (!sendBtn.disabled) {
                        // 다양한 클릭 방법 시도 (기존 방식)
                        const clickMethods = [
                            () => sendBtn.click(),
                            () => {
                                sendBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                            },
                            () => {
                                const rect = sendBtn.getBoundingClientRect();
                                const x = rect.left + rect.width / 2;
                                const y = rect.top + rect.height / 2;
                                sendBtn.dispatchEvent(new MouseEvent('mousedown', { 
                                    bubbles: true, clientX: x, clientY: y 
                                }));
                                sendBtn.dispatchEvent(new MouseEvent('mouseup', { 
                                    bubbles: true, clientX: x, clientY: y 
                                }));
                                sendBtn.dispatchEvent(new MouseEvent('click', { 
                                    bubbles: true, clientX: x, clientY: y 
                                }));
                            }
                        ];
                        
                        for (let i = 0; i < clickMethods.length; i++) {
                            try {
                                console.log(`[MultiAI] Claude 클릭 방법 ${i + 1} 시도`);
                                clickMethods[i]();
                                await this.sleep(500);
                                
                                // 향상된 성공 확인
                                sendSuccess = await this.verifyTransmissionSuccess(inputEl, initialInputText);
                                if (sendSuccess) {
                                    console.log(`[MultiAI] Claude 클릭 방법 ${i + 1} 성공`);
                                    break;
                                }
                            } catch (clickError) {
                                console.log(`[MultiAI] Claude 클릭 방법 ${i + 1} 실패:`, clickError.message);
                            }
                        }
                    } else {
                        console.log('[MultiAI] Claude 전송 버튼이 여전히 비활성화 상태');
                    }
                } catch (btnError) {
                    console.log('[MultiAI] Claude 버튼 클릭 전체 실패:', btnError.message);
                }
            }
            
            // 버튼 클릭이 실패한 경우 Enter 키로 전송 시도 (기존 방식)
            if (!sendSuccess) {
                console.log('[MultiAI] Claude 버튼 클릭 실패, Enter 키로 전송 시도');
                
                try {
                    inputEl.focus();
                    await this.sleep(300);
                    
                    // 다양한 Enter 키 이벤트 시도
                    const enterMethods = [
                        () => {
                            inputEl.dispatchEvent(new KeyboardEvent('keydown', {
                                key: 'Enter',
                                code: 'Enter',
                                bubbles: true,
                                cancelable: true
                            }));
                        },
                        () => {
                            inputEl.dispatchEvent(new KeyboardEvent('keydown', {
                                key: 'Enter',
                                ctrlKey: true,
                                bubbles: true,
                                cancelable: true
                            }));
                        },
                        () => {
                            inputEl.dispatchEvent(new KeyboardEvent('keypress', {
                                key: 'Enter',
                                bubbles: true,
                                cancelable: true
                            }));
                        }
                    ];
                    
                    for (let i = 0; i < enterMethods.length; i++) {
                        try {
                            console.log(`[MultiAI] Claude Enter 방법 ${i + 1} 시도`);
                            enterMethods[i]();
                            await this.sleep(800);
                            
                            // 향상된 성공 확인
                            sendSuccess = await this.verifyTransmissionSuccess(inputEl, initialInputText);
                            if (sendSuccess) {
                                console.log(`[MultiAI] Claude Enter 방법 ${i + 1} 성공`);
                                break;
                            }
                        } catch (enterError) {
                            console.log(`[MultiAI] Claude Enter 방법 ${i + 1} 실패:`, enterError.message);
                        }
                    }
                } catch (enterError) {
                    console.log('[MultiAI] Claude Enter 키 전송 전체 실패:', enterError.message);
                }
            }

            // 최종 성공 확인 (좀 더 관대하게)
            if (!sendSuccess) {
                console.log('[MultiAI] Claude 추가 성공 확인 시도');
                await this.sleep(1000);
                sendSuccess = await this.verifyTransmissionSuccess(inputEl, initialInputText);
            }

            if (sendSuccess) {
                console.log(`[MultiAI] Claude에 메시지 전송 완료`);
                return { 
                    success: true, 
                    message: '메시지 전송 완료', 
                    site: this.siteName,
                    extensionEnabled: this.extensionEnabled
                };
            } else {
                // 부드러운 실패 처리 - 경고 대신 정보 메시지 (기존 방식)
                console.log('[MultiAI] Claude 전송 확인 실패, 하지만 메시지가 전송되었을 수 있음');
                return { 
                    success: true, // 성공으로 처리하여 오류 메시지 방지
                    message: '메시지 전송 시도 완료 (확인 불가)', 
                    site: this.siteName,
                    extensionEnabled: this.extensionEnabled,
                    warning: '전송 확인에 실패했지만 메시지가 전송되었을 수 있습니다.'
                };
            }

        } catch (error) {
            console.log('[MultiAI] Claude sendMessage 최종 오류:', error);
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

    // Claude 특정: 전송 성공 여부를 더 정확하게 확인하는 메서드 (기존 방식)
    async verifyTransmissionSuccess(inputEl, initialInputText) {
        try {
            // 다양한 성공 지표 확인
            const successIndicators = [
                // 1. 스트리밍 상태 확인
                () => document.querySelector('[data-is-streaming="true"]'),
                
                // 2. 로딩 응답 확인
                () => document.querySelector('.loading-response'),
                
                // 3. 정지 버튼 확인
                () => document.querySelector('[data-testid="stop-button"]'),
                () => document.querySelector('button[aria-label="Stop"]'),
                
                // 4. 입력창이 비워졌는지 확인
                () => {
                    const currentText = inputEl.textContent || inputEl.innerText || '';
                    return currentText.trim() === '' || currentText.trim() !== initialInputText.trim();
                },
                
                // 5. 전송 버튼이 비활성화되었는지 확인
                () => {
                    const sendBtn = this.findElement(this.getSelectors().sendButton);
                    return sendBtn && sendBtn.disabled;
                },
                
                // 6. 새로운 대화 턴이 생성되었는지 확인
                () => document.querySelector('[data-testid="conversation-turn"]:last-child [data-is-streaming="true"]'),
                
                // 7. 입력창의 placeholder 변화 확인
                () => {
                    const placeholder = inputEl.getAttribute('data-placeholder');
                    return placeholder && placeholder.includes('Claude is thinking');
                }
            ];
            
            // 하나라도 성공 지표가 감지되면 성공으로 판단
            for (const indicator of successIndicators) {
                try {
                    if (indicator()) {
                        console.log('[MultiAI] Claude 전송 성공 지표 감지');
                        return true;
                    }
                } catch (e) {
                    // 개별 지표 확인 실패는 무시
                }
            }
            
            return false;
        } catch (e) {
            console.log('[MultiAI] Claude 전송 확인 중 오류:', e);
            return false;
        }
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
                return { responseText: null };
            }
            
            // 가장 최근 응답 선택
            const lastResponse = responseElements[responseElements.length - 1];
            const responseText = extractTextFromElement(lastResponse);
            
            return { 
                responseText: responseText.trim(), 
                site: this.siteName,
                extensionEnabled: this.extensionEnabled
            };
        } catch (error) {
            console.log('[MultiAI] Claude getLatestResponse 오류:', error);
            return { 
                responseText: null, 
                error: error.message, 
                site: this.siteName,
                extensionEnabled: this.extensionEnabled
            };
        }
    }

    // Claude 특정: 스트리밍 응답 감지 (기존 방식)
    async waitForResponse(timeout = 30000) {
        const start = Date.now();
        let sawLoading = false;
        
        while (Date.now() - start < timeout) {
            // Claude의 스트리밍 상태 확인
            const loadingEl = this.findElement(this.getSelectors().loadingIndicator);
            const streamingEl = document.querySelector('[data-is-streaming="true"]');
            
            if (loadingEl || streamingEl) {
                sawLoading = true;
            } else if (sawLoading) {
                // 스트리밍이 끝났으면 조금 더 대기
                await this.sleep(2000);
                return;
            }
            await this.sleep(1000);
        }
        
        if (!sawLoading) {
            return;
        }
        throw new Error('Claude 응답 대기 시간 초과');
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // MD Export 기능: 대화 데이터 추출
    // ─────────────────────────────────────────────────────────────────────────────

    getConversationData() {
        debugLog('claude', 'Getting conversation data');
        
        const title = this.extractTitle();
        const messageBlocks = document.querySelectorAll('[data-test-render-count]');
        let userCount = 0, assistantCount = 0;

        // 방법 1: data-test-render-count 기반
        messageBlocks.forEach(block => {
            if (block.querySelector('[data-testid="user-message"]')) {
                userCount++;
            }
            if (block.querySelector('.font-claude-message')) {
                assistantCount++;
            }
        });

        // 방법 2: 대화 턴 기반 (백업)
        if (userCount === 0 && assistantCount === 0) {
            const conversationTurns = document.querySelectorAll('[data-testid="conversation-turn"]');
            conversationTurns.forEach(turn => {
                if (turn.querySelector('[data-testid="user-message"]')) {
                    userCount++;
                }
                if (turn.querySelector('.prose, .font-claude-message')) {
                    assistantCount++;
                }
            });
        }

        const result = {
            title: title,
            userMessages: userCount,
            assistantMessages: assistantCount,
            totalMessages: userCount + assistantCount,
            serviceName: this.siteName,
            detectionMethod: messageBlocks.length > 0 ? 'test-render-count' : 'fallback',
            timestamp: new Date().toISOString()
        };

        debugLog('claude', 'Conversation data extracted', result);
        return result;
    }

    extractTitle() {
        const titleSources = [
            // 방법 1: 활성 대화 제목
            () => {
                const activeConversation = document.querySelector('.conversation.selected .conversation-title');
                return activeConversation?.textContent?.trim();
            },
            
            // 방법 2: 페이지 헤더
            () => {
                const headerTitle = document.querySelector('h1, [role="heading"]');
                if (headerTitle && headerTitle.textContent.trim() && 
                    !headerTitle.textContent.includes('Claude')) {
                    return headerTitle.textContent.trim();
                }
            },
            
            // 방법 3: 문서 제목에서 추출
            () => {
                let title = document.title;
                title = title.replace(/Claude\s*[-|]?\s*/gi, '')
                            .replace(/\s*[-|]?\s*Claude/gi, '')
                            .trim();
                return title;
            }
        ];

        for (const source of titleSources) {
            try {
                const title = source();
                if (title && title.length > 0) {
                    return title;
                }
            } catch (error) {
                debugLog('claude', 'Title extraction error:', error);
            }
        }

        return 'Claude 대화';
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // MD Export 기능: 마크다운 생성
    // ─────────────────────────────────────────────────────────────────────────────

    generateMarkdown(includeUser, includeAssistant) {
        let markdown = '';
        const messageBlocks = document.querySelectorAll('[data-test-render-count]');

        messageBlocks.forEach((block, index) => {
            const userMessage = block.querySelector('[data-testid="user-message"]');
            if (userMessage && includeUser) {
                const userText = userMessage.textContent.trim();
                if (userText) {
                    markdown += `## 👤 사용자\n\n${userText}\n\n`;
                }
            }

            const claudeMessage = block.querySelector('.font-claude-message');
            if (claudeMessage && includeAssistant) {
                const claudeText = this.convertAssistantMessage(claudeMessage);
                if (claudeText) {
                    markdown += `## ${this.serviceEmoji} ${this.siteName}\n\n${claudeText}\n\n`;
                }
            }

            if (index < messageBlocks.length - 1 && (userMessage || claudeMessage)) {
                markdown += '---\n\n';
            }
        });

        return markdown || '대화 내용을 추출할 수 없습니다.';
    }

    convertAssistantMessage(claudeElement) {
        let markdown = '';
        const contentGrids = claudeElement.querySelectorAll('.grid-cols-1.grid.gap-2\\.5');
        
        contentGrids.forEach(contentGrid => {
            Array.from(contentGrid.children).forEach(child => {
                const tagName = child.tagName.toLowerCase();
                const text = child.textContent.trim();
                if (!text) return;
                
                switch (tagName) {
                    case 'p':
                        markdown += `${text}\n\n`;
                        break;
                    case 'h1':
                        markdown += `# ${text}\n\n`;
                        break;
                    case 'h2':
                        markdown += `## ${text}\n\n`;
                        break;
                    case 'h3':
                        markdown += `### ${text}\n\n`;
                        break;
                    case 'ul':
                        child.querySelectorAll('li').forEach(li => {
                            markdown += `- ${li.textContent.trim()}\n`;
                        });
                        markdown += '\n';
                        break;
                    case 'ol':
                        child.querySelectorAll('li').forEach((li, idx) => {
                            markdown += `${idx + 1}. ${li.textContent.trim()}\n`;
                        });
                        markdown += '\n';
                        break;
                    case 'pre':
                        const code = child.querySelector('code');
                        if (code) {
                            const language = code.className.match(/language-(\w+)/)?.[1] || '';
                            markdown += `\`\`\`${language}\n${code.textContent}\n\`\`\`\n\n`;
                        } else {
                            markdown += `\`\`\`\n${text}\n\`\`\`\n\n`;
                        }
                        break;
                    case 'blockquote':
                        text.split('\n').forEach(line => {
                            if (line.trim()) {
                                markdown += `> ${line.trim()}\n`;
                            }
                        });
                        markdown += '\n';
                        break;
                    default:
                        markdown += `${text}\n\n`;
                        break;
                }
            });
        });

        // 아티팩트 내용 추출
        const artifacts = claudeElement.querySelectorAll('[data-artifact]');
        artifacts.forEach(artifact => {
            const artifactTitle = artifact.querySelector('[data-testid="artifact-title"]')?.textContent?.trim();
            const artifactContent = artifact.querySelector('code, pre, .artifact-content')?.textContent?.trim();
            
            if (artifactTitle && artifactContent) {
                markdown += `### ${artifactTitle}\n\n\`\`\`\n${artifactContent}\n\`\`\`\n\n`;
            }
        });

        return markdown.trim() || extractTextFromElement(claudeElement);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Claude 특화 초기화 및 관찰자
    // ─────────────────────────────────────────────────────────────────────────────

    initialize() {
        debugLog('claude', 'Claude interface initializing');
        
        // Claude 특화 초기화
        this.setupConversationObserver();
        
        debugLog('claude', 'Claude interface initialization complete');
    }

    setupConversationObserver() {
        // Claude의 새로운 메시지 생성을 감지
        const observer = new MutationObserver(debounce(() => {
            const newMessages = document.querySelectorAll('[data-test-render-count]');
            debugLog('claude', `Messages detected: ${newMessages.length}`);
        }, 1000));

        const targetNode = document.querySelector('main') || document.body;
        observer.observe(targetNode, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-test-render-count']
        });

        debugLog('claude', 'Conversation observer setup complete');
    }

    destroy() {
        super.destroy();
        debugLog('claude', 'Claude interface destroyed');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Claude 서비스 모듈 등록 (기존 안정적인 초기화 방식 사용)
// ─────────────────────────────────────────────────────────────────────────────

// 안전한 초기화 함수
function initializeClaudeInterface() {
    // content_common.js 로드 대기
    const maxWaitTime = 10000; // 10초
    const startTime = Date.now();
    
    function attemptInit() {
        if (Date.now() - startTime > maxWaitTime) {
            console.error('[Universal AI Assistant] Claude: content_common.js 로드 시간 초과');
            return;
        }
        
        if (!window.UniversalAIAssistant || !window.UniversalAIAssistant.BaseAISiteInterface) {
            console.log('[Universal AI Assistant] Claude: content_common.js 로드 대기 중...');
            setTimeout(attemptInit, 500);
            return;
        }

        // 기존 인터페이스 정리 (더 안전하게)
        if (window.aiServiceModule) {
            console.log('[Universal AI Assistant] Claude: 기존 인터페이스 정리');
            try {
                if (typeof window.aiServiceModule.destroy === 'function') {
                    window.aiServiceModule.destroy();
                }
            } catch (e) {
                console.log('[Universal AI Assistant] Claude: 기존 인터페이스 정리 중 오류:', e);
            }
            window.aiServiceModule = null;
        }

        try {
            console.log('[Universal AI Assistant] Claude: 새 인터페이스 생성 시도');
            window.aiServiceModule = new ClaudeInterface();
            console.log('[Universal AI Assistant] Claude 전용 인터페이스 초기화 완료');
        } catch (e) {
            console.error('[Universal AI Assistant] Claude 초기화 실패:', e);
            // 재시도
            setTimeout(initializeClaudeInterface, 2000);
        }
    }
    
    attemptInit();
}

// DOM 상태에 따른 초기화
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeClaudeInterface);
} else {
    // 약간의 지연을 두고 초기화 (content_common.js 로드 시간 확보)
    setTimeout(initializeClaudeInterface, 100);
}

// 추가 안전장치
window.addEventListener('load', () => {
    setTimeout(initializeClaudeInterface, 1000);
});

// URL 변경 감지 (SPA 대응)
let lastURL = location.href;
const urlObserver = new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastURL) {
        lastURL = currentUrl;
        console.log('[Universal AI Assistant] Claude URL 변경 감지, 재초기화:', currentUrl);
        
        if (window.aiServiceModule) {
            try {
                if (typeof window.aiServiceModule.destroy === 'function') {
                    window.aiServiceModule.destroy();
                }
            } catch (error) {
                // 에러 무시
            }
            window.aiServiceModule = null;
        }
        
        setTimeout(initializeClaudeInterface, 2000);
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
            // 에러 무시
        }
    }
    
    if (urlObserver) {
        urlObserver.disconnect();
    }
});

// Claude 전용 디버그 함수
window.debugClaude = function() {
    if (window.aiServiceModule && window.aiServiceModule.siteName === 'Claude') {
        console.log('=== Claude Debug ===');
        console.log('Service module:', window.aiServiceModule);
        console.log('Connection status:', window.aiServiceModule.checkConnection());
        console.log('Conversation data:', window.aiServiceModule.getConversationData());
        
        try {
            const markdown = window.aiServiceModule.generateMarkdown(true, true);
            console.log('Generated markdown preview:', markdown.substring(0, 500) + '...');
        } catch (error) {
            console.log('Markdown generation error:', error);
        }
    } else {
        console.log('Claude module not loaded or not on Claude page');
    }
};

// 디버그 로그 헬퍼 (common에서 가져오기)
function debugLog(category, message, data = null) {
    if (window.UniversalAIAssistant?.utils?.debugLog) {
        window.UniversalAIAssistant.utils.debugLog(category, message, data);
    } else {
        // 폴백 - 기존 방식 사용
        if (console && console.log) {
            const timestamp = new Date().toISOString();
            const logMessage = `[Universal AI Assistant] [${timestamp}] [${category.toUpperCase()}] ${message}`;
            if (data) {
                console.log(logMessage, data);
            } else {
                console.log(logMessage);
            }
        }
    }
}

// 디바운스 함수 (common에서 가져오기)
function debounce(func, wait) {
    if (window.UniversalAIAssistant?.utils?.debounce) {
        return window.UniversalAIAssistant.utils.debounce(func, wait);
    } else {
        // 폴백 - 기존 방식 사용
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
        // 폴백 - 기존 방식 사용
        return element ? element.textContent || element.innerText || '' : '';
    }
}

console.log('🧠 Universal AI Assistant - Claude Service Module 로드 완료 (버그 수정된 버전)');