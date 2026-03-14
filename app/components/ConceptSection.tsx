import React from 'react';
import { X, Check, Image as ImageIcon } from 'lucide-react';

function ConceptSection() {
  return (
    <section className="w-full py-24 px-6 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
        
        {/* Text Content */}
        <div className="flex-1 space-y-10 w-full">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
            Most students don't fail because they are <span className="text-red-500">lazy</span>.
          </h2>
          
          <div className="space-y-6">
            <p className="text-2xl font-semibold text-gray-800">
              They fail because:
            </p>
            <ul className="space-y-5">
              <li className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <X className="w-5 h-5 text-red-600" />
                </div>
                <span className="text-xl text-gray-600 font-medium">They fall behind early</span>
              </li>
              <li className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <X className="w-5 h-5 text-red-600" />
                </div>
                <span className="text-xl text-gray-600 font-medium">They don't revise consistently</span>
              </li>
              <li className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <X className="w-5 h-5 text-red-600" />
                </div>
                <span className="text-xl text-gray-600 font-medium">They don't realize they are struggling until exams</span>
              </li>
            </ul>
          </div>

          <div className="pt-8 border-t border-gray-100">
            <div className="inline-flex items-start sm:items-center gap-4 p-6 bg-green-50 rounded-2xl border border-green-200 shadow-sm">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <Check className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-xl font-medium text-gray-900 leading-relaxed">
                <span className="text-green-600 font-bold">StudyBuddy</span> brings everything together into one intelligent system.
              </p>
            </div>
          </div>
        </div>

        {/* Image Placeholder */}
        <div className="flex-1 w-full">
          <div className="aspect-square sm:aspect-[4/3] lg:aspect-auto lg:h-[600px] w-full rounded-3xl bg-gray-50 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden group hover:bg-gray-100 hover:border-gray-400 transition-all cursor-pointer">
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 bg-white shadow-sm rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-300">
                <ImageIcon className="w-10 h-10 text-gray-400" />
              </div>
              <p className="font-semibold text-xl text-gray-700">Add Image Here</p>
              <p className="text-base text-gray-500 max-w-[250px]">
                A picture of a frustrated student would work perfectly here.
              </p>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}

export default ConceptSection;
