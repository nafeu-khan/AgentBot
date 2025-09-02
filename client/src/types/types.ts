export interface Message {
        id: string;
        role: "user" | "assistant";
        content: string;
        timestamp: Date;
        metadata?: {
                timestamp?: string;
                isFresh?: boolean;
                ageInSeconds?: number;
                source?: string;
                count?: number;
                processingTime?: number;
        };
}

export interface StreamChunk {
        type: "token" | "complete" | "error";
        content?: string;
        response?: string;
        toolsUsed?: string[];
        sessionId?: string;
        metadata?: any;
        error?: string;
}


export interface ObservabilityData {
        success: boolean;
        langsmith: {
                enabled: boolean;
                project: string;
                endpoint: string;
                hasApiKey: boolean;
                tracing: boolean;
        };
        environment: {
                nodeEnv: string;
                timestamp: string;
        };
}

export interface DashboardData {
        success: boolean;
        dashboardUrl?: string;
        project?: string;
        message?: string;
}
