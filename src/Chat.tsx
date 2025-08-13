import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';

interface Message {
    id: number;
    text: string;
    sender: 'user' | 'bot';
    timestamp: Date;
}

interface ApiResponse {
    output?: string;
}

const ChatApp: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // N8N webhook URL
    const N8N_WEBHOOK_URL: string = 'https://n8n.moveon.run/webhook/chat';

    // Load messages from local storage on component mount
    useEffect(() => {
        try {
            const storedMessages = localStorage.getItem('chatHistory');
            if (storedMessages) {
                // Parse dates correctly
                const parsedMessages: Message[] = JSON.parse(storedMessages).map((msg: any) => ({
                    ...msg,
                    timestamp: new Date(msg.timestamp)
                }));
                setMessages(parsedMessages);
            }
        } catch (error) {
            console.error("Failed to load chat history from local storage:", error);
            // Optionally clear corrupted data
            localStorage.removeItem('chatHistory');
        }
    }, []);

    // Save messages to local storage whenever messages state changes
    useEffect(() => {
        if (messages.length > 0) { // Only save if there are messages
            try {
                // Keep only the last 100 messages
                const messagesToSave = messages.slice(Math.max(messages.length - 100, 0));
                localStorage.setItem('chatHistory', JSON.stringify(messagesToSave));
            } catch (error) {
                console.error("Failed to save chat history to local storage:", error);
            }
        }
        scrollToBottom(); // Keep scroll to bottom logic here
    }, [messages]);

    const scrollToBottom = (): void => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const sendMessage = async (): Promise<void> => {
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
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const formatMessage = (text: string): React.ReactNode[] => {
        const lines: string[] = text.split('\n');

        return lines.map((line: string, index: number) => {
            // Handle table rows
            if (line.includes('|')) {
                const cells: string[] = line.split('|').filter(cell => cell.trim() !== '');

                // Check if it's a header row (contains dashes)
                if (line.includes('---')) {
                    return (
                        <div key={index} className="border-b border-gray-600 my-3"></div>
                    );
                }

                // Regular table row
                if (cells.length > 1) {
                    return (
                        <div key={index} className="grid grid-cols-2 gap-4 py-2 border-b border-gray-700/50">
                            {cells.map((cell: string, cellIndex: number) => (
                                <div
                                    key={cellIndex}
                                    className={`${cellIndex === 0 ? 'font-medium text-blue-300' : 'text-gray-200'}`}
                                >
                                    {cell.trim().replace(/\*\*(.*?)\*\*/g, '$1')}
                                </div>
                            ))}
                        </div>
                    );
                }
            }

            // Handle bold text **text**
            if (line.includes('**')) {
                const parts: string[] = line.split(/(\*\*.*?\*\*)/);
                return (
                    <div key={index} className="py-1">
                        {parts.map((part: string, partIndex: number) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                                return (
                                    <span key={partIndex} className="font-semibold text-blue-300">
                    {part.slice(2, -2)}
                  </span>
                                );
                            }
                            return <span key={partIndex}>{part}</span>;
                        })}
                    </div>
                );
            }

            // Handle italic text
            if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**')) {
                return (
                    <div key={index} className="py-1 text-gray-400 italic text-sm">
                        {line.slice(1, -1)}
                    </div>
                );
            }

            // Handle empty lines
            if (line.trim() === '') {
                return <div key={index} className="py-1"></div>;
            }

            // Regular text
            return (
                <div key={index} className="py-1">
                    {line}
                </div>
            );
        });
    };

    const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>): void => {
        const target = e.target as HTMLTextAreaElement;
        target.style.height = 'auto';
        target.style.height = Math.min(target.scrollHeight, 120) + 'px';
    };

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
                                        {formatMessage(message.text)}
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
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInputMessage(e.target.value)}
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
        </div>
    );
};

export default ChatApp;