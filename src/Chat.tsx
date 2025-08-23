import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, Bot, User, Loader2, X, Copy, Check } from 'lucide-react';
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { materialOceanic } from "react-syntax-highlighter/dist/esm/styles/prism";

interface Message {
    id: number;
    text: string;
    sender: 'user' | 'bot';
    timestamp: Date;
}

interface ApiResponse {
    output?: string;
}

// Memoized ChatResponseView component to prevent unnecessary re-renders
const ChatResponseView: React.FC<{
    text: string;
    sender: "bot" | 'user';
}> = React.memo(({ text, sender }) => {
    const [copied, setCopied] = useState(false);
    const timeoutRef = useRef<any>(null);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);

            // Clear existing timeout
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            // Set new timeout
            timeoutRef.current = setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy text: ", err);
        }
    }, [text]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    // Memoize the formatted text to prevent recalculation
    const formattedText = useMemo(() => {
        return text.replace(
            /(https?:\/\/[^\s]+(\.png|\.jpg|\.jpeg|\.gif))/gi,
            "![]($1)"
        );
    }, [text]);

    // Memoize markdown components to prevent recreation
    const markdownComponents = useMemo(() => ({
        img({ src, alt }: { src?: string; alt?: string }) {
            return (
                <img
                    src={src || ""}
                    alt={alt || "image"}
                    className="max-w-full rounded-lg my-2 border border-gray-300 shadow-sm cursor-pointer hover:opacity-90"
                    loading="lazy"
                    onClick={() => window.open(src, "_blank")}
                />
            );
        },
        code({ inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || "");
            return !inline && match ? (
                <SyntaxHighlighter
                    style={materialOceanic as { [key: string]: React.CSSProperties }}
                    language={match[1]}
                    PreTag="div"
                    {...props}
                >
                    {String(children).replace(/\n$/, "")}
                </SyntaxHighlighter>
            ) : (
                <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded" {...props}>
                    {children}
                </code>
            );
        },
    }), []);

    return (
        <div className="relative">
            {/* Copy Button - Only for bot messages */}
            {sender === "bot" && (
                <button
                    onClick={handleCopy}
                    className="absolute bottom-[-39px] right-0 p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition bg-transparent"
                    title="Copy message"
                >
                    {copied ? (
                        <Check size={16} className="text-green-500" />
                    ) : (
                        <Copy size={16} className="text-gray-500" />
                    )}
                </button>
            )}

            {/* Render Message */}
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
                components={markdownComponents}
            >
                {formattedText}
            </ReactMarkdown>
        </div>
    );
});

ChatResponseView.displayName = 'ChatResponseView';

// Main ChatApp Component
const ChatApp: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [imageModalOpen, setImageModalOpen] = useState<boolean>(false);
    const [modalImageSrc, setModalImageSrc] = useState<string>('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // N8N webhook URL
    const N8N_WEBHOOK_URL: string = 'https://n8n.moveon.run/webhook/chat';

    // Load messages from local storage on component mount
    useEffect(() => {
        try {
            const storedMessages = localStorage.getItem('chatHistory');
            if (storedMessages) {
                const parsedMessages: Message[] = JSON.parse(storedMessages).map((msg: any) => ({
                    ...msg,
                    timestamp: new Date(msg.timestamp)
                }));
                setMessages(parsedMessages);
            }
        } catch (error) {
            console.error("Failed to load chat history from local storage:", error);
            localStorage.removeItem('chatHistory');
        }
    }, []);

    // Save messages to local storage whenever messages state changes
    useEffect(() => {
        if (messages.length > 0) {
            try {
                const messagesToSave = messages.slice(Math.max(messages.length - 100, 0));
                localStorage.setItem('chatHistory', JSON.stringify(messagesToSave));
            } catch (error) {
                console.error("Failed to save chat history to local storage:", error);
            }
        }
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = useCallback((): void => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    const closeImageModal = useCallback((): void => {
        setImageModalOpen(false);
        setModalImageSrc('');
    }, []);

    const sendMessage = useCallback(async (): Promise<void> => {
        if (!inputMessage.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now(),
            text: inputMessage,
            sender: 'user',
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputMessage('');
        setIsLoading(true);

        try {
            const response = await fetch(N8N_WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: inputMessage,
                }),
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data: ApiResponse = await response.json();

            const botMessage: Message = {
                id: Date.now() + 1,
                text: data.output || 'Sorry, I could not process your request.',
                sender: 'bot',
                timestamp: new Date()
            };

            setMessages(prev => [...prev, botMessage]);
        } catch (error) {
            console.error('Error sending message:', error);
            const errorMessage: Message = {
                id: Date.now() + 1,
                text: 'Sorry, I encountered an error while processing your request. Please try again.',
                sender: 'bot',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    }, [inputMessage, isLoading, N8N_WEBHOOK_URL]);

    const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }, [sendMessage]);

    const handleTextareaInput = useCallback((e: React.FormEvent<HTMLTextAreaElement>): void => {
        const target = e.target as HTMLTextAreaElement;
        target.style.height = 'auto';
        target.style.height = Math.min(target.scrollHeight, 120) + 'px';
    }, []);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputMessage(e.target.value);
    }, []);

    // Memoized message components to prevent unnecessary re-renders
    const messageComponents = useMemo(() => (
        messages.map((message: Message) => (
            <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
                <div
                    className={`flex max-w-3xl ${
                        message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
                    } space-x-3`}
                >
                    <div className="flex-shrink-0">
                        <div
                            className={`p-2 rounded-full shadow-lg ${
                                message.sender === 'user'
                                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500'
                                    : 'bg-gradient-to-r from-gray-600 to-gray-700'
                            }`}
                        >
                            {message.sender === 'user' ? (
                                <User className="w-5 h-5 text-white" />
                            ) : (
                                <Bot className="w-5 h-5 text-white" />
                            )}
                        </div>
                    </div>
                    <div
                        className={`px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-sm max-w-full ${
                            message.sender === 'user'
                                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white ml-3 border border-blue-500/30'
                                : 'bg-gray-800/90 text-gray-100 border border-gray-700/50 mr-3'
                        }`}
                    >
                        <div className={`leading-relaxed ${
                            message.sender === 'user' ? 'text-sm' : 'text-sm'
                        }`}>
                            <ChatResponseView sender={message.sender} text={message.text} />
                        </div>
                        <div
                            className={`text-xs mt-2 ${
                                message.sender === 'user'
                                    ? 'text-blue-100'
                                    : 'text-gray-400'
                            }`}
                        >
                            {message.timestamp.toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </div>
                    </div>
                </div>
            </div>
        ))
    ), [messages]);

    return (
        <div className="flex flex-col h-[90vh] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 relative overflow-hidden">
            {/* Animated background elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse delay-2000"></div>
            </div>

            {/* Reflex overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/[0.02] to-transparent pointer-events-none"></div>

            {/* Header */}
            <div className="relative z-10 bg-gray-800/80 backdrop-blur-xl border-b border-gray-700/50 px-6 py-3 shadow-2xl">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full shadow-lg">
                        <Bot className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h3 className="text-md md:text-lg font-medium md:font-semibold text-green-400">MoveAI Assistant</h3>
                    </div>
                </div>
            </div>

            {/* Messages Container */}
            <div className="relative z-10 flex-1 overflow-y-auto px-6 py-4 space-y-6">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="p-4 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full mb-4 shadow-2xl animate-pulse">
                            <Bot className="w-12 h-12 text-white" />
                        </div>
                        <h2 className="text-2xl font-semibold text-white mb-2">
                            Welcome to AI Assistant
                        </h2>
                        <p className="text-gray-400 max-w-md">
                            Start a conversation by typing your message below. I'm here to help you with any questions you might have.
                        </p>
                    </div>
                ) : (
                    messageComponents
                )}

                {/* Loading indicator */}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="flex space-x-3">
                            <div className="flex-shrink-0">
                                <div className="p-2 rounded-full bg-gradient-to-r from-gray-600 to-gray-700 shadow-lg">
                                    <Bot className="w-5 h-5 text-white" />
                                </div>
                            </div>
                            <div className="px-4 py-3 rounded-2xl bg-gray-800/90 border border-gray-700/50 shadow-2xl backdrop-blur-sm">
                                <div className="flex items-center space-x-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                                    <span className="text-sm text-gray-300">Thinking...</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Section */}
            <div className="relative z-10 bg-gray-800/80 backdrop-blur-xl border-t border-gray-700/50 px-6 py-4 shadow-2xl">
                <div className="flex space-x-3">
                    <div className="flex-1 relative">
                        <textarea
                            ref={inputRef}
                            value={inputMessage}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyPress}
                            placeholder="Type your message here..."
                            rows={1}
                            className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600/50 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 text-white placeholder-gray-400 backdrop-blur-sm transition-all duration-200 hover:bg-gray-700/70"
                            style={{
                                minHeight: '48px',
                                maxHeight: '120px'
                            }}
                            onInput={handleTextareaInput}
                        />
                    </div>
                    <button
                        onClick={sendMessage}
                        disabled={!inputMessage.trim() || isLoading}
                        className="px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-2xl hover:from-blue-600 hover:to-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center min-w-[48px] shadow-lg hover:shadow-xl transform hover:scale-105 disabled:hover:scale-100"
                    >
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Send className="w-5 h-5" />
                        )}
                    </button>
                </div>
                <div className="mt-2 text-xs text-gray-500 text-center">
                    Press Enter to send, Shift+Enter for new line
                </div>
            </div>

            {/* Image Modal */}
            {imageModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="relative max-w-4xl max-h-full">
                        <button
                            onClick={closeImageModal}
                            className="absolute -top-4 -right-4 bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-full shadow-lg transition-colors duration-200 z-10"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <img
                            src={modalImageSrc}
                            alt="Full size view"
                            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                            onClick={closeImageModal}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatApp;