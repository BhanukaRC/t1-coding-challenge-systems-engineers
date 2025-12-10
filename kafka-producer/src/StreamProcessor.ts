import { ReadableStream } from "stream/web";

export class StreamProcessor {
    private buffer: string = '';
    private decoder = new TextDecoder('utf-8');

    constructor(private onMessage: (message: any) => Promise<void>) { }

    async processStream(stream: ReadableStream<Uint8Array>) {
        const reader = stream.getReader();

        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                // Process any remaining buffered data when stream ends
                await this.processBuffer(true);
                break;
            }

            if (value) {
                // Decode the chunk and add it to the buffer
                this.buffer += this.decoder.decode(value, { stream: true });
                await this.processBuffer();
            }
        }
    }

    private async processBuffer(isEnd: boolean = false) {
        let boundary: number;

        while ((boundary = this.buffer.indexOf('\n')) >= 0) {
            const completeLine = this.buffer.slice(0, boundary).trim(); // Extract the complete line
            this.buffer = this.buffer.slice(boundary + 1); // Remove the processed line from the buffer

            if (completeLine.startsWith('data: ')) {
                const jsonString = completeLine.slice(6); // Remove the "data: " prefix
                try {
                    const parsedMessage = JSON.parse(jsonString);
                    await this.onMessage(parsedMessage);
                } catch (error) {
                    console.error('Failed to parse JSON:', jsonString, error);
                }
            }
        }

        if (isEnd && this.buffer.trim()) {
            // If it's the end of the stream and there's leftover data
            try {
                const parsedMessage = JSON.parse(this.buffer.trim());
                await this.onMessage(parsedMessage);
            } catch (error) {
                console.error('Failed to parse JSON at the end of stream:', this.buffer.trim(), error);
            }
        }
    }
}
