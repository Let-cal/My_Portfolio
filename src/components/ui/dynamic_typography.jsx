import { ArrowRightCircle } from "lucide-react";
import { useEffect, useState } from "react";

export default function DynamicTypography() {
  const [isHovered, setIsHovered] = useState(false);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    // Simulate intersection observer with a simple timeout for demo purposes
    const timer = setTimeout(() => {
      setIsInView(true);
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center w-full py-12 bg-black relative overflow-hidden">
      {/* Ambient animated backgrounds */}
      <div className="absolute w-64 h-64 rounded-full bg-orange-500/10 blur-3xl -left-20 -top-20 opacity-50"></div>
      <div className="absolute w-64 h-64 rounded-full bg-gray-500/10 blur-3xl -right-20 -bottom-20 opacity-50"></div>

      <div
        className={`relative transition-all duration-700 ${
          isInView ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <h2
          className={`text-3xl md:text-4xl lg:text-5xl font-black font-sans tracking-tight relative z-10 transition-transform duration-500 ${
            isHovered ? "transform scale-105" : ""
          }`}
        >
          {/* First word with crisp white */}
          <span className="relative inline-block overflow-hidden mr-2 md:mr-3 group">
            <span className="bg-gradient-to-br from-gray-100 to-white bg-clip-text text-transparent relative z-10">
              Certifications
            </span>
            <span
              className={`absolute inset-0 bg-white/10 transform origin-left transition-transform duration-500 ${
                isHovered ? "scale-x-100" : "scale-x-0"
              }`}
            ></span>
          </span>

          {/* Divider element */}
          <span className="inline-flex items-center mx-1 md:mx-2 relative">
            <ArrowRightCircle
              className={`text-gray-400 transition-all duration-500 ${
                isHovered ? "rotate-90 text-orange-400" : ""
              }`}
              size={28}
            />
          </span>

          {/* Second word with brand orange */}
          <span className="relative inline-block overflow-hidden ml-2 md:ml-3 group">
            <span className="bg-gradient-to-br from-orange-400 to-orange-500 bg-clip-text text-transparent relative z-10">
              Activities
            </span>
            <span
              className={`absolute inset-0 bg-orange-500/10 transform origin-right transition-transform duration-500 ${
                isHovered ? "scale-x-100" : "scale-x-0"
              }`}
            ></span>
          </span>
        </h2>

        {/* Animated underline that appears on hover - using your brand color */}
        <div
          className={`h-1 mt-3 bg-gradient-to-r from-gray-200 via-orange-400 to-orange-500 rounded-full transition-all duration-700 ${
            isHovered ? "w-full opacity-100" : "w-0 opacity-0"
          }`}
        ></div>

        {/* Small contrasting subtext */}
        <p
          className={`text-gray-400 text-sm md:text-base mt-4 text-center w-full transition-all duration-500 ${
            isHovered ? "opacity-100" : "opacity-70"
          }`}
        >
          Balancing formal qualifications with hands-on experience
        </p>
      </div>
    </div>
  );
}
