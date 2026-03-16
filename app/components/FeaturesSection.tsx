import React from 'react';
import Image from 'next/image';
import { Sparkles, Library, TrendingUp, Calendar, BrainCircuit } from 'lucide-react';
import { Titillium_Web, Outfit } from 'next/font/google';

const titillium = Titillium_Web({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
});

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
});

const features = [
  {
    id: 'course-assistant',
    title: 'AI Course Assistant',
    subtitle: 'Ask questions about any topic and get clear explanations.',
    description: 'StudyBuddy’s AI understands the context of your course materials, topics, and previous questions. Instead of generic answers, you get explanations tailored to what you’re currently studying and where you might be struggling.',
    icon: <Sparkles className="w-5 h-5 text-green-600" />,
    image: '/aibook.png',
    span: 'col-span-1 md:col-span-2 lg:col-span-3' // Large featured card
  },
  {
    id: 'knowledge-library',
    title: 'Knowledge Library',
    subtitle: 'Upload slides, textbooks, and notes into a structured study system.',
    description: 'Keep all your learning materials in one organized place. StudyBuddy structures everything by course, topic, and subtopic so you can easily find resources, connect ideas, and study without digging through scattered files.',
    icon: <Library className="w-5 h-5 text-green-600" />,
    image: '/library.jpg',
    span: 'col-span-1 md:col-span-2'
  },
  {
    id: 'adaptive-planner',
    title: 'Adaptive Planner',
    subtitle: 'Automatically adjusts when you fall behind.',
    description: 'StudyBuddy monitors your progress and upcoming academic deadlines. If you start falling behind or an exam is approaching, the system adapts your study plan and suggests what to focus on next.',
    icon: <Calendar className="w-5 h-5 text-green-600" />,
    image: '/adaptive.jpg',
    span: 'col-span-1 md:col-span-2'
  },
  {
    id: 'progress-tracking',
    title: 'Smart Progress Tracking',
    subtitle: 'See exactly how well you understand each topic.',
    description: 'Track your mastery across courses and topics with clear visual indicators. StudyBuddy helps you identify weak areas early so you can focus your time where it matters most before exams.',
    icon: <TrendingUp className="w-5 h-5 text-green-600" />,
    image: '/progress tracking.jpg',
    span: 'col-span-1 md:col-span-2 lg:col-span-3 lg:row-span-1' // Tall featured card on the side
  },
  {
    id: 'memory-revision',
    title: 'Memory-Based Revision',
    subtitle: 'Recall important concepts at the right time.',
    description: 'Instead of forgetting what you studied last week, StudyBuddy sends smart reminders and quick review prompts that reinforce important ideas, helping you retain knowledge for the long term.',
    icon: <BrainCircuit className="w-5 h-5 text-green-600" />,
    image: '/memory.jpg',
    span: 'col-span-1 md:col-span-2 lg:col-span-4' // Wide bottom card
  }
];

export default function FeaturesSection() {
  return (
    <section id="features" className="w-full py-16 sm:py-24 px-4 bg-gray-50 overflow-hidden relative">
      
      {/* Background decorations */}
      <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-green-100/40 rounded-full blur-[100px] -z-10 transform translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-blue-50/50 rounded-full blur-[100px] -z-10 transform -translate-x-1/2 translate-y-1/2"></div>

      <div className=" mx-auto space-y-16">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 text-green-700 font-medium text-sm mb-4 border border-green-200">
            <Sparkles className="w-4 h-4" /> Capabilities
          </div>
          <h2 className={`text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 leading-tight ${titillium.className}`}>
            Everything you need to <span className="text-green-500"><i>master</i></span> your courses.
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-600">
            StudyBuddy doesn&apos;t just store your notes. It actively helps you understand them, remember them, and ace your exams.
          </p>
        </div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4 sm:gap-6 auto-rows-[minmax(250px,_auto)] sm:auto-rows-[minmax(300px,_auto)]">
          {features.map((feature) => (
            <div 
              key={feature.id}
              className={`group flex flex-col rounded-[2.5rem] bg-white border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-500 overflow-hidden relative isolate ${feature.span}`}
            >
              {/* Card Text Content (Top) */}
              <div className={`p-6 sm:p-8 md:p-10 flex-shrink-0 z-10 relative ${outfit.className}`}>
                <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center mb-6 shadow-sm border border-green-100 group-hover:scale-110 group-hover:bg-green-100 transition-all duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm font-medium text-gray-700/50 mb-4 tracking-wide">{feature.subtitle}</p>
                <p className="text-gray-500/90 leading-relaxed max-w-xl">
                  {feature.description}
                </p>
              </div>

              {/* Specific Layout Adjustments based on Card Size */}
              <div className={`mt-auto relative w-full flex-grow flex items-end justify-center ${feature.id === 'progress-tracking' ? 'px-8 pt-0' : 'px-8 pb-0'}`}>
                {/* Image Presentation */}
                <div className={`w-full bg-gray-50/50 rounded-t-2xl border-t border-x border-gray-200 backdrop-blur-sm overflow-hidden 
                    ${feature.id === 'progress-tracking' ? 'h-40 sm:h-48 md:h-[400px] border-b-0 rounded-b-none translate-y-4 group-hover:-translate-y-2 group-hover:scale-[1.02] transition-all duration-500 origin-bottom' : 'h-40 sm:h-48 md:h-[350px] translate-y-4 group-hover:translate-y-2 transition-transform duration-500'}`}>
                  
                  {/* Actual Mockup Image Area */}
                  <div className="w-full h-full relative bg-gray-100 flex items-center justify-center overflow-hidden">
                    <Image 
                      src={feature.image} 
                      fill 
                      className={`object-cover object-top ${feature.id === 'knowledge-library' || feature.id === 'adaptive-planner' || feature.id === 'memory-revision' ? 'object-center' : ''}`}
                      alt={feature.title} 
                    />
                  </div>
                </div>
              </div>

            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
