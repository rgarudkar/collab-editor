"use client";

import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

export default function NetworkHealthSparkline() {
    const containerRef = useRef<HTMLDivElement>(null);
    const [latencyData, setLatencyData] = useState<number[]>([20, 25, 22, 30, 28, 40, 35, 25, 20, 18, 22, 24, 25, 28, 30, 25, 22, 20, 15, 18]);

    useEffect(() => {
        // Simulate real-time latency updates
        const interval = setInterval(() => {
            setLatencyData((prev) => {
                const newData = [...prev.slice(1)];
                // Generate a random walk for realistic latency flutter
                const lastVal = newData[newData.length - 1] || 25;
                const jump = (Math.random() - 0.5) * 15;
                newData.push(Math.max(10, Math.min(150, lastVal + jump)));
                return newData;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!containerRef.current || latencyData.length === 0) return;

        // Dimensions
        const width = 120;
        const height = 40;
        const margin = { top: 5, right: 5, bottom: 5, left: 5 };

        // Clear previous SVG
        d3.select(containerRef.current).selectAll("*").remove();

        const svg = d3
            .select(containerRef.current)
            .append("svg")
            .attr("width", width)
            .attr("height", height);

        // Scales
        const xScale = d3
            .scaleLinear()
            .domain([0, latencyData.length - 1])
            .range([margin.left, width - margin.right]);

        const yScale = d3
            .scaleLinear()
            .domain([0, Math.max(100, d3.max(latencyData) || 100)])
            .range([height - margin.bottom, margin.top]);

        // Line generator
        const line = d3
            .line<number>()
            .x((d, i) => xScale(i))
            .y((d) => yScale(d))
            .curve(d3.curveMonotoneX); // Smooth curve

        // Area generator for gradient fill
        const area = d3
            .area<number>()
            .x((d, i) => xScale(i))
            .y0(height - margin.bottom)
            .y1((d) => yScale(d))
            .curve(d3.curveMonotoneX);

        const currentLatency = Math.round(latencyData[latencyData.length - 1]);
        const isGood = currentLatency < 60;
        const isWarn = currentLatency >= 60 && currentLatency < 100;

        // Gradient setup
        const defs = svg.append("defs");
        const gradient = defs
            .append("linearGradient")
            .attr("id", "latency-gradient")
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "0%")
            .attr("y2", "100%");

        gradient
            .append("stop")
            .attr("offset", "0%")
            .attr("stop-color", isGood ? "#22c55e" : isWarn ? "#eab308" : "#ef4444")
            .attr("stop-opacity", 0.4);

        gradient
            .append("stop")
            .attr("offset", "100%")
            .attr("stop-color", isGood ? "#22c55e" : isWarn ? "#eab308" : "#ef4444")
            .attr("stop-opacity", 0);

        // Draw area
        svg
            .append("path")
            .datum(latencyData)
            .attr("fill", "url(#latency-gradient)")
            .attr("d", area);

        // Draw line
        svg
            .append("path")
            .datum(latencyData)
            .attr("fill", "none")
            .attr("stroke", isGood ? "#22c55e" : isWarn ? "#eab308" : "#ef4444")
            .attr("stroke-width", 1.5)
            .attr("d", line);

    }, [latencyData]);

    const currentLatency = Math.round(latencyData[latencyData.length - 1] || 0);

    return (
        <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
                <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Network Ping</span>
                <span className={`text-xs font-bold font-mono ${currentLatency < 60 ? 'text-green-400' : currentLatency < 100 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {currentLatency}ms
                </span>
            </div>
            <div ref={containerRef} className="w-[120px] h-[40px] opacity-80 mix-blend-screen" />
        </div>
    );
}
