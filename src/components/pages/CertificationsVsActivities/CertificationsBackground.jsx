import { gsap } from "gsap";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { SplitText } from "gsap/SplitText";
import { useEffect, useRef } from "react";

export default function CertificationsBackground() {
  // Refs for DOM elements
  const quotesContainerRef = useRef(null);
  const scrambleRef = useRef(null);

  // Initial scrambled text
  const initialScramble = "*&@#$#@#$@*&$(@#^)";

  // Quotes to be displayed
  const quotes = [
    "Bringing ideas to life, one pixel at a time.",
    "Code is the brush, the browser is my canvas.",
    "Design with purpose. Build with passion.",
    "Every interaction should feel like magic.",
    "Beautiful UI meets clean, maintainable code.",
    "Simplicity isn't basic—it's brilliant.",
    "Where creativity meets functionality.",
  ];

  // Returns a random position within the viewport boundaries
  const getRandomPosition = () => {
    // Limit position to visible area with some padding
    const padding = 100;
    const x = padding + Math.random() * (window.innerWidth - padding * 2);
    const y = padding + Math.random() * (window.innerHeight - padding * 2);
    return { x, y };
  };

  useEffect(() => {
    // Register GSAP plugins
    gsap.registerPlugin(SplitText, ScrambleTextPlugin);

    // Setup scramble text in the center
    gsap.set(scrambleRef.current, {
      scrambleText: {
        text: initialScramble,
        chars: "upperAndLowerCase",
        speed: 0.3,
      },
    });

    // Create master timeline for controlling the flow
    const masterTimeline = gsap.timeline({
      repeat: -1,
    });

    // Setup quotes animation with controlled sequence
    if (quotesContainerRef.current) {
      const quotesElements =
        quotesContainerRef.current.querySelectorAll(".quote");

      // Set initial styles for all quotes
      gsap.set(quotesElements, {
        position: "absolute",
        opacity: 0,
        whiteSpace: "nowrap",
      });

      // For each quote, create a timeline and add it to the master timeline
      quotesElements.forEach((quote, index) => {
        // Position each quote in a random location
        const { x, y } = getRandomPosition();
        gsap.set(quote, { x, y });

        // Create timeline for this quote
        const quoteTimeline = gsap.timeline();

        // Scramble the text in
        quoteTimeline
          .to(quote, {
            duration: 1.5,
            opacity: 1,
            scrambleText: {
              text: quote.textContent,
              chars: "upperAndLowerCase",
              revealDelay: 0.8,
              speed: 0.5,
            },
            ease: "power2.out",
          })
          // Hold the text visible for reading
          .to(quote, {
            duration: 2.5, // Extended duration to give time to read
            opacity: 1, // Keep fully visible
          })
          // Scramble the text out
          .to(quote, {
            duration: 1.5,
            scrambleText: {
              text: "",
              chars: "upperAndLowerCase",
              speed: 0.5,
            },
            opacity: 0,
            ease: "power2.in",
          })
          // Move to a new random position for next appearance
          .call(() => {
            const newPos = getRandomPosition();
            gsap.set(quote, { x: newPos.x, y: newPos.y });
          });

        // Add this quote's timeline to the master timeline with staggered start
        masterTimeline.add(quoteTimeline, index * 2); // 2 second stagger
      });
    }

    // Animate the central scramble text
    gsap.to(scrambleRef.current, {
      duration: 3,
      scrambleText: {
        text: initialScramble,
        chars: "upperAndLowerCase",
        speed: 0.3,
      },
      repeat: -1,
      repeatDelay: 2,
      yoyo: true,
    });

    // Cleanup function
    return () => {
      // Kill all GSAP animations to prevent memory leaks
      masterTimeline.kill();
      gsap.killTweensOf(scrambleRef.current);
    };
  }, []);

  return (
    <section className="cert-bg absolute inset-0 w-full min-h-screen overflow-hidden bg-black text-white/30 text-xs font-semibold pointer-events-none z-0">
      <div ref={quotesContainerRef}>
        {quotes.map((quote, index) => (
          <div key={index} className="quote absolute opacity-0">
            {quote}
          </div>
        ))}
      </div>
      <div
        ref={scrambleRef}
        className="scramble absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center select-none"
      >
        {initialScramble}
      </div>
    </section>
  );
}
