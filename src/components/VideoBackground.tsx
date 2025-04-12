// src/components/VideoBackground.tsx
"use client";
import { useState, useRef, useEffect } from 'react';

interface VideoBackgroundProps {
  videoSrc: string;
  children: React.ReactNode;
}

const VideoBackground = ({ videoSrc, children }: VideoBackgroundProps) => {
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    // Set playback rate to 0.5 (half speed) once the video is loaded
    if (videoRef.current) {
      videoRef.current.playbackRate = 0.5;
    }
  }, [videoLoaded]);
  
  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Background Video */}
      <div className="absolute inset-0 overflow-hidden">
        <video 
          ref={videoRef}
          autoPlay 
          loop 
          muted 
          playsInline
          onLoadedData={() => setVideoLoaded(true)}
          className={`object-cover w-full h-full transition-opacity duration-700 ${videoLoaded ? 'opacity-100' : 'opacity-0'}`}
        >
          <source src={videoSrc} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        {/* Overlay to make text more readable */}
        <div className="absolute inset-0 bg-black opacity-70"></div>
      </div>
      
      {/* Content */}
      <div className="relative flex-grow flex flex-col items-center justify-center z-10">
        {children}
      </div>
    </div>
  );
};

export default VideoBackground;