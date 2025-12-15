import { StreamProcessor } from "@/components/StreamProcessor";
import { useEffect, useState } from "react";

export function useStream<T>(endpoint: string) {
    const [data, setData] = useState<T>();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch(`http://localhost:3001${endpoint}`);

                if (!response.ok) {
                    console.error("Failed to fetch stream:", response.statusText);
                    return;
                }

                if (!response.body) {
                    console.error("Response body is null");
                    return;
                }

                function onMessage(message: T) {
                    setData(message);
                }

                const streamProcessor = new StreamProcessor(onMessage);

                await streamProcessor.processStream(response.body as any);

                console.log("Stream processing complete");
            } catch (err) {
                console.error("Failed to fetch stream:", err);
            }
        };

        fetchData();

        // Cleanup function to abort the fetch request on component unmount
        return () => {
            // Implement abort logic if necessary
        };
    }, []);

    return data;
};