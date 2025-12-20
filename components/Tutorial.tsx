import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, ArrowLeft, Play } from 'lucide-react';
import Character from './Character';

interface TutorialProps {
  onClose: () => void;
}

const Tutorial: React.FC<TutorialProps> = ({ onClose }) => {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "게임 목표",
      content: (
        <div className="space-y-4">
          <p className="text-slate-600 leading-relaxed">
            보드 위의 모든 칸을 점령하거나 상대방의 모든 말을 없애면 승리합니다!
          </p>
          <div className="flex items-center justify-center gap-8 mt-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-2">
                <Character player={1} />
              </div>
              <p className="text-xs font-bold text-cyan-600">블루 팀</p>
            </div>
            <div className="text-2xl font-black text-slate-300">VS</div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-2">
                <Character player={2} />
              </div>
              <p className="text-xs font-bold text-rose-600">레드 팀</p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "말 선택하기",
      content: (
        <div className="space-y-4">
          <p className="text-slate-600 leading-relaxed">
            자신의 말을 클릭하여 선택합니다. 선택된 말은 노란색 링으로 표시됩니다.
          </p>
          <div className="flex items-center justify-center gap-4 mt-6">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-2 relative">
                <div className="absolute inset-0 ring-4 ring-yellow-400 rounded-lg scale-110"></div>
                <Character player={1} isSelected={true} />
              </div>
              <p className="text-xs font-bold text-slate-600">선택됨</p>
            </div>
            <ArrowRight className="w-8 h-8 text-slate-400" />
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-2">
                <Character player={1} />
              </div>
              <p className="text-xs font-bold text-slate-600">선택 안됨</p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "클론 이동 (Clone)",
      content: (
        <div className="space-y-4">
          <p className="text-slate-600 leading-relaxed">
            <strong className="text-green-600">초록색 링</strong>이 표시된 칸은 클론 이동이 가능합니다.
            <br />
            인접한 칸(1칸 거리)으로 이동하면 원래 말은 그대로 남고 새로운 말이 생성됩니다.
          </p>
          <div className="mt-6 p-4 bg-slate-50 rounded-xl">
            <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
              {[0, 1, 2].map((r) => (
                [0, 1, 2].map((c) => {
                  const isFrom = r === 0 && c === 0;
                  const isTo = r === 1 && c === 1;
                  const isHighlighted = isTo;
                  return (
                    <div
                      key={`${r}-${c}`}
                      className={`aspect-square rounded-lg flex items-center justify-center border-2 ${
                        isHighlighted
                          ? 'bg-green-50 border-green-400 ring-4 ring-green-400'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      {isFrom && <Character player={1} />}
                      {isTo && <Character player={1} />}
                      {!isFrom && !isTo && (
                        <div className="text-xs text-slate-400">빈 칸</div>
                      )}
                    </div>
                  );
                })
              ))}
            </div>
            <div className="mt-4 text-center">
              <div className="inline-flex items-center gap-2 text-sm text-green-600 font-bold">
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
                클론: 원래 말 유지 + 새 말 생성
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "점프 이동 (Jump)",
      content: (
        <div className="space-y-4">
          <p className="text-slate-600 leading-relaxed">
            <strong className="text-yellow-600">노란색 링</strong>이 표시된 칸은 점프 이동이 가능합니다.
            <br />
            2칸 이상 떨어진 칸으로 이동하면 원래 말이 사라지고 새로운 위치에 나타납니다.
          </p>
          <div className="mt-6 p-4 bg-slate-50 rounded-xl">
            <div className="grid grid-cols-5 gap-1 max-w-xs mx-auto">
              {[0, 1, 2, 3, 4].map((r) => (
                [0, 1, 2, 3, 4].map((c) => {
                  const isFrom = r === 2 && c === 2;
                  const isTo = r === 0 && c === 0;
                  const isHighlighted = isTo;
                  return (
                    <div
                      key={`${r}-${c}`}
                      className={`aspect-square rounded flex items-center justify-center border ${
                        isHighlighted
                          ? 'bg-yellow-50 border-yellow-400 ring-2 ring-yellow-400'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      {isFrom && <Character player={1} />}
                      {isTo && <Character player={1} />}
                    </div>
                  );
                })
              ))}
            </div>
            <div className="mt-4 text-center">
              <div className="inline-flex items-center gap-2 text-sm text-yellow-600 font-bold">
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                점프: 원래 말 제거 + 새 위치로 이동
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "감염 (Infection)",
      content: (
        <div className="space-y-4">
          <p className="text-slate-600 leading-relaxed">
            말을 이동하면 이동한 위치의 <strong>인접한 8칸</strong>에 있는 상대방의 말이 모두 당신의 말로 바뀝니다!
            이것이 게임의 핵심 전략입니다.
          </p>
          <div className="mt-6 p-4 bg-slate-50 rounded-xl">
            <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
              {[0, 1, 2].map((r) => (
                [0, 1, 2].map((c) => {
                  const isCenter = r === 1 && c === 1;
                  const isInfected = (r === 0 && c === 1) || (r === 1 && c === 0) || (r === 1 && c === 2) || (r === 2 && c === 1);
                  const isCorner = (r === 0 && c === 0) || (r === 0 && c === 2) || (r === 2 && c === 0) || (r === 2 && c === 2);
                  
                  return (
                    <div
                      key={`${r}-${c}`}
                      className={`aspect-square rounded-lg flex items-center justify-center border-2 ${
                        isCenter
                          ? 'bg-cyan-100 border-cyan-400 ring-4 ring-cyan-400'
                          : isInfected
                          ? 'bg-rose-100 border-rose-300'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      {isCenter && <Character player={1} />}
                      {isInfected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-full h-full flex items-center justify-center"
                        >
                          <Character player={1} />
                        </motion.div>
                      )}
                      {isCorner && <div className="text-xs text-slate-400">빈 칸</div>}
                    </div>
                  );
                })
              ))}
            </div>
            <div className="mt-4 text-center space-y-2">
              <div className="text-xs text-slate-500">
                이동 전: <span className="text-rose-600 font-bold">레드</span> 말이 인접해 있음
              </div>
              <div className="text-xs text-slate-500">
                이동 후: 인접한 <span className="text-rose-600 font-bold">레드</span> 말이 <span className="text-cyan-600 font-bold">블루</span>로 감염됨!
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "전략 팁",
      content: (
        <div className="space-y-4">
          <div className="space-y-3 text-slate-600">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-sm flex-shrink-0 mt-0.5">
                1
              </div>
              <p>클론은 말을 늘리는 데 유용하고, 점프는 빠르게 이동할 때 사용하세요.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-sm flex-shrink-0 mt-0.5">
                2
              </div>
              <p>상대방 말 주변으로 이동하여 감염시키는 것이 승리의 열쇠입니다.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-sm flex-shrink-0 mt-0.5">
                3
              </div>
              <p>보드의 중앙을 장악하면 더 많은 이동 옵션을 얻을 수 있습니다.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-sm flex-shrink-0 mt-0.5">
                4
              </div>
              <p>상대방이 이동할 수 있는 칸을 미리 차단하는 것도 좋은 전략입니다.</p>
            </div>
          </div>
        </div>
      )
    }
  ];

  const nextStep = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onClose();
    }
  };

  const prevStep = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border-4 border-indigo-200"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-cyan-500 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
          <h2 className="text-3xl font-black mb-2">게임 튜토리얼</h2>
          <div className="flex items-center gap-2">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all ${
                  i === step ? 'bg-white flex-1' : i < step ? 'bg-white/50 flex-1' : 'bg-white/20 flex-1'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h3 className="text-2xl font-black text-slate-800 mb-4">
                {steps[step].title}
              </h3>
              {steps[step].content}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-6 flex justify-between items-center">
          <button
            onClick={prevStep}
            disabled={step === 0}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
              step === 0
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            <ArrowLeft size={20} />
            이전
          </button>
          
          <button
            onClick={nextStep}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-indigo-500 text-white hover:bg-indigo-600 transition-all shadow-lg"
          >
            {step === steps.length - 1 ? (
              <>
                시작하기
                <Play size={20} />
              </>
            ) : (
              <>
                다음
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default Tutorial;

