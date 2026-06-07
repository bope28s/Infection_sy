import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy } from 'lucide-react';
import { getPVPRanking, getPointRanking, getPlayerRank, RankingEntry, PlayerRecord } from '../services/backend';

interface RankingProps {
  onClose: () => void;
  currentPlayer: PlayerRecord | null;
}

const Ranking: React.FC<RankingProps> = ({ onClose, currentPlayer }) => {
  const [activeTab, setActiveTab] = useState<'pvp' | 'point'>('pvp');
  const [pvpRanking, setPvpRanking] = useState<RankingEntry[]>([]);
  const [pointRanking, setPointRanking] = useState<RankingEntry[]>([]);
  const [playerPVPRank, setPlayerPVPRank] = useState<number>(-1);
  const [playerPointRank, setPlayerPointRank] = useState<number>(-1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRankings();
  }, []);

  const loadRankings = async () => {
    try {
      setLoading(true);
      const [pvpData, pointData] = await Promise.all([
        getPVPRanking(100),
        getPointRanking(100)
      ]);
      setPvpRanking(pvpData);
      setPointRanking(pointData);

      // 현재 플레이어의 랭킹 위치 찾기
      if (currentPlayer) {
        const [pvpRank, pointRank] = await Promise.all([
          getPlayerRank(currentPlayer.id, 'pvp'),
          getPlayerRank(currentPlayer.id, 'point')
        ]);
        setPlayerPVPRank(pvpRank);
        setPlayerPointRank(pointRank);
      }
    } catch (error) {
      console.error('Ranking load failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMedalBadge = (rank: number) => {
    if (rank === 1) return <span className="text-yellow-500">🥇</span>;
    if (rank === 2) return <span className="text-gray-400">🥈</span>;
    if (rank === 3) return <span className="text-orange-600">🥉</span>;
    return null;
  };

  const renderRankingTable = (ranking: RankingEntry[]) => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-slate-400">로딩 중...</div>
        </div>
      );
    }

    if (ranking.length === 0) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-slate-400">아직 기록이 없습니다.</div>
        </div>
      );
    }

    // 등수 순서대로 정렬 (백엔드에서 이미 정렬되어 있지만 안전을 위해)
    // 백엔드에서 이미 등수와 알파벳 순으로 정렬되어 있으므로 그대로 사용
    const sortedRanking = [...ranking];
    
    // 상위 5등 추출 (등수 기준)
    const top5ByRank = sortedRanking.filter(entry => entry.rank <= 5);
    
    // 본인 랭킹 찾기
    const currentPlayerEntry = sortedRanking.find(entry => 
      currentPlayer && entry.nickname === currentPlayer.nickname
    );
    const isCurrentPlayerInTop5 = currentPlayerEntry && currentPlayerEntry.rank <= 5;
    
    // 표시할 항목들: 상위 5등 + 본인 (본인이 상위 5등에 없을 경우만)
    const displayEntries = isCurrentPlayerInTop5 
      ? top5ByRank 
      : currentPlayerEntry 
        ? [...top5ByRank, currentPlayerEntry]
        : top5ByRank;

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-2"
        >
          {displayEntries.map((entry, index) => {
            const isCurrentPlayer = currentPlayer && entry.nickname === currentPlayer.nickname;
            const isSeparator = !isCurrentPlayerInTop5 && currentPlayerEntry && index === 5;
            
            return (
              <React.Fragment key={`${entry.nickname}-${entry.rank}-${activeTab}`}>
                {isSeparator && (
                  <div className="py-2 border-t-2 border-dashed border-indigo-300 my-2">
                    <div className="text-xs text-slate-400 text-center font-bold">...</div>
                  </div>
                )}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                    isCurrentPlayer
                      ? 'bg-indigo-100 border-2 border-indigo-400'
                      : entry.rank <= 3
                      ? 'bg-gradient-to-r from-slate-50 to-white border border-slate-200'
                      : 'bg-white border border-slate-200'
                  }`}
                >
                {/* 순위 */}
                <div className="flex items-center justify-center w-12 h-12 rounded-full font-black text-lg">
                  {entry.rank <= 3 ? (
                    <div className="text-2xl">{getMedalBadge(entry.rank)}</div>
                  ) : (
                    <span className={isCurrentPlayer ? 'text-indigo-600' : 'text-slate-400'}>
                      {entry.rank}
                    </span>
                  )}
                </div>

                {/* 닉네임 */}
                <div className="flex-1 flex items-center gap-2">
                  <span className={`font-bold text-lg ${isCurrentPlayer ? 'text-indigo-700' : 'text-slate-800'}`}>
                    {entry.nickname}
                  </span>
                  {/* 레벨 */}
                  <span className={`text-sm font-bold px-2 py-1 rounded-full ${
                    entry.level >= 7 ? 'bg-purple-100 text-purple-700' :
                    entry.level >= 5 ? 'bg-blue-100 text-blue-700' :
                    entry.level >= 3 ? 'bg-green-100 text-green-700' :
                    entry.level >= 1 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    Lv.{entry.level}
                  </span>
                  {isCurrentPlayer && (
                    <span className="text-xs bg-indigo-500 text-white px-2 py-1 rounded-full font-bold">
                      나
                    </span>
                  )}
                </div>

                {/* 점수 - 나의 점수만 표시 */}
                <div className="text-right">
                  {isCurrentPlayer && (
                    <div className={`font-black text-xl ${isCurrentPlayer ? 'text-indigo-600' : 'text-slate-700'}`}>
                      {activeTab === 'pvp' ? `${entry.score}승` : `${entry.score.toLocaleString()}점`}
                    </div>
                  )}
                </div>
              </motion.div>
            </React.Fragment>
          );
        })}
        </motion.div>
      </AnimatePresence>
    );
  };

  const currentRank = activeTab === 'pvp' ? playerPVPRank : playerPointRank;

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
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="w-8 h-8" />
            <h2 className="text-3xl font-black">랭킹</h2>
          </div>

          {/* 탭 */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('pvp')}
              className={`px-6 py-2 rounded-xl font-bold transition-all ${
                activeTab === 'pvp'
                  ? 'bg-white text-indigo-600 shadow-lg'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              다승리그
            </button>
            <button
              onClick={() => setActiveTab('point')}
              className={`px-6 py-2 rounded-xl font-bold transition-all ${
                activeTab === 'point'
                  ? 'bg-white text-indigo-600 shadow-lg'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              포인트리그
            </button>
          </div>
        </div>

        {/* 현재 플레이어 랭킹 표시 */}
        {currentPlayer && currentRank > 0 && (
          <div className="px-6 py-3 bg-indigo-50 border-b border-indigo-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-indigo-700">
                {activeTab === 'pvp' ? '다승리그' : '포인트리그'} 내 순위
              </span>
              <span className="text-lg font-black text-indigo-600">
                {currentRank}위
              </span>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'pvp' ? renderRankingTable(pvpRanking) : renderRankingTable(pointRanking)}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-4 bg-slate-50">
          <div className="text-xs text-slate-500 text-center">
            {activeTab === 'pvp' 
              ? '다승리그: 대전게임 승리 횟수 순위'
              : '포인트리그: AI 대전 난이도별 점수 순위 (1단계=2점, 2단계=4점, 3단계=8점...)'}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Ranking;

