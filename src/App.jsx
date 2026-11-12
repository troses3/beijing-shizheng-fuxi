import { useState, useEffect, useRef, useMemo } from 'react';
import { initialBeijingShizheng } from './data/beijing_shizheng';
import { triggerHaptic } from './utils/haptics';
import './App.css';

const getShortMeaning = (meaning) => {
  if (!meaning) return "";
  
  let parts = meaning.split('。')
    .map(p => p.trim())
    .filter(p => {
      if (!p) return false;
      if (p.includes('：') || p.includes(':')) return false;
      const isSynonymRef = p.startsWith('同“') || p.startsWith('同"') || p.startsWith('同「');
      return !isSynonymRef;
    });
    
  if (parts.length === 0) {
    return meaning;
  }
  
  const keywords = ['指', '是指', '是', '即', '属于', '体现了', '决定', '要求', '标志', '作为'];
  let firstKwIdx = -1;
  for (let idx = 0; idx < parts.length; idx++) {
    const part = parts[idx];
    if (keywords.some(kw => part.includes(kw))) {
      firstKwIdx = idx;
      break;
    }
  }
  
  if (firstKwIdx !== -1) {
    parts = parts.slice(firstKwIdx);
  }
  
  const result = parts.join('。') + (meaning.endsWith('。') ? '。' : '');
  if (result.replace(/[。，；、“”‘’（）]/g, '').trim().length > 1) {
    return result;
  }
  
  return meaning;
};

const escapeRegExp = (str) => {
  if (!str) return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const renderSentenceWithBlank = (sentence, word) => {
  if (!sentence) return '（暂无例句）';
  if (!word) return sentence;

  const escaped = escapeRegExp(word);
  const regex = new RegExp(escaped, 'g');
  if (regex.test(sentence)) {
    return sentence.replace(regex, '______');
  }

  const cleanWord = word.replace(/[“”"''《》【】]/g, '');
  if (cleanWord && cleanWord !== word) {
    const cleanEscaped = escapeRegExp(cleanWord);
    const cleanRegex = new RegExp(`[“"《]?${cleanEscaped}[”"》]?`, 'g');
    if (cleanRegex.test(sentence)) {
      return sentence.replace(cleanRegex, '______');
    }
  }

  return sentence;
};

const renderHighlightedSentence = (sentence, word) => {
  if (!sentence) return null;
  if (!word) return <span>{sentence}</span>;

  const escaped = escapeRegExp(word);
  let regex = new RegExp(`(${escaped})`, 'g');
  if (!regex.test(sentence)) {
    const cleanWord = word.replace(/[“”"''《》【】]/g, '');
    if (cleanWord && cleanWord !== word) {
      const cleanEscaped = escapeRegExp(cleanWord);
      regex = new RegExp(`([“"《]?${cleanEscaped}[”"》]?)`, 'g');
    }
  }

  const parts = sentence.split(regex);
  return parts.map((part, i) => {
    const isTarget = part === word || part.replace(/[“”"''《》【】]/g, '') === word.replace(/[“”"''《》【】]/g, '');
    return isTarget ? (
      <span key={i} className="filled-idiom">{part}</span>
    ) : (
      part
    );
  });
};

function SpeedItemCard({ item, idx, globalMasked }) {
  const [isRevealed, setIsRevealed] = useState(!globalMasked);

  useEffect(() => {
    setIsRevealed(!globalMasked);
  }, [globalMasked]);

  // 获取完整句子（若 hint 带下划线则还原为包含考点词的完整句，确保精准内联遮罩）
  const fullSentence = useMemo(() => {
    if (item.hint && item.hint.includes('______')) {
      return item.hint.replace(/______/g, item.word);
    }
    if (item.examples && item.examples.length > 0) {
      return item.examples[0];
    }
    return item.meaning || '';
  }, [item]);

  const escaped = escapeRegExp(item.word);
  let regex = new RegExp(`(${escaped})`, 'g');
  if (!regex.test(fullSentence)) {
    const cleanWord = item.word.replace(/[“”"''《》【】]/g, '');
    if (cleanWord && cleanWord !== item.word) {
      const cleanEscaped = escapeRegExp(cleanWord);
      regex = new RegExp(`([“"《]?${cleanEscaped}[”"》]?)`, 'g');
    }
  }
  const parts = fullSentence.split(regex);

  const toggleReveal = (e) => {
    e.stopPropagation();
    triggerHaptic('tap');
    setIsRevealed(prev => !prev);
  };

  return (
    <div className="speed-item-card" onClick={toggleReveal}>
      <div className="speed-word-row">
        <span className="speed-label">考点 {idx + 1}</span>
        <span 
          className={`speed-blank ${!isRevealed ? 'masked' : 'revealed'}`}
          onClick={toggleReveal}
          title={!isRevealed ? '点击揭晓考点词' : '点击遮挡'}
        >
          {item.word}
        </span>
        <span className="speed-cat-tag">
          {item.group ? item.group.replace(/[【】]/g, '') : ''} · {item.subcategory || ''}
        </span>
      </div>

      <div className="speed-meaning">
        {parts.map((part, i) => {
          const isTarget = part === item.word || part.replace(/[“”"''《》【】]/g, '') === item.word.replace(/[“”"''《》【】]/g, '');
          return isTarget ? (
            <span 
              key={i} 
              className={`speed-inline-blank ${!isRevealed ? 'masked' : 'revealed'}`}
              title={!isRevealed ? '点击揭晓' : '点击遮挡'}
            >
              {part}
            </span>
          ) : (
            <span key={i}>{part}</span>
          );
        })}
      </div>

      {isRevealed && item.meaning && item.meaning !== fullSentence && (
        <div className="speed-detail-meaning">
          💡 <strong>考点拓展：</strong>{item.meaning}
        </div>
      )}
    </div>
  );
}

function KnowledgeSentenceCard({ sentenceItem, searchQuery }) {
  const highlightQuery = (text, query) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="search-highlight">{part}</mark>
      ) : part
    );
  };

  return (
    <div className="knowledge-card">
      <div className="knowledge-card-header">
        <span className="knowledge-badge">{sentenceItem.group}</span>
        <span className="knowledge-chapter">{sentenceItem.subcategory || sentenceItem.chapter}</span>
      </div>
      <div className="knowledge-sentence-text">
        {highlightQuery(sentenceItem.meaning, searchQuery)}
      </div>
      <div className="knowledge-words-tag-list">
        {sentenceItem.words.map((w, wIdx) => (
          <span key={wIdx} className="knowledge-word-tag">
            🎯 {highlightQuery(w, searchQuery)}
          </span>
        ))}
      </div>
    </div>
  );
}

function App() {
  const headerRef = useRef(null);
  const skipCategoryResetRef = useRef(true);
  const modeBarRef = useRef(null);
  const cardBackInnerRef = useRef(null);
  const actionButtonsRef = useRef(null);

  const [calculatedMarginTop, setCalculatedMarginTop] = useState(0);
  const [cardHeight, setCardHeight] = useState('340px');

  const [items, setItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [currentIndex, setCurrentIndex] = useState(() => {
    const savedMode = localStorage.getItem('bj-shizheng-active-mode') || 'quiz';
    const saved = localStorage.getItem(`bj-shizheng-current-index_${savedMode}`);
    if (saved !== null) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 0) return parsed;
    }
    return 0;
  });
  const [isFlipped, setIsFlipped] = useState(false);
  const [stats, setStats] = useState({ known: 0, unsure: 0, unknown: 0 });
  const [filter, setFilter] = useState('all'); // 'all', 'known', 'unsure', 'unknown'
  const [isRandom, setIsRandom] = useState(() => {
    return localStorage.getItem('bj-shizheng-random') === 'true';
  });
  const [activeMode, setActiveMode] = useState(() => {
    return localStorage.getItem('bj-shizheng-active-mode') || 'quiz';
  }); // 'quiz', 'speed', 'contrast'
  const [hideBlanksInSpeedMode, setHideBlanksInSpeedMode] = useState(true);
  const [currentExample, setCurrentExample] = useState('');
  const [history, setHistory] = useState([]);

  useEffect(() => {
    localStorage.setItem(`bj-shizheng-current-index_${activeMode}`, currentIndex);
  }, [currentIndex, activeMode]);

  const [shuffledOptions, setShuffledOptions] = useState([]);
  const [selectedOption, setSelectedOption] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [inspectingSearchItem, setInspectingSearchItem] = useState(null);

  // Dynamic Vertical Centering Calculation (True Geometric Symmetry across all 3 steps)
  useEffect(() => {
    const calcMargin = () => {
      if (headerRef.current && modeBarRef.current) {
        const headerBottom = headerRef.current.getBoundingClientRect().bottom + window.scrollY;
        const modeBarTop = modeBarRef.current.getBoundingClientRect().top;
        const space = modeBarTop - headerBottom;
        const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        const gapPx = 0.75 * rem;

        let currentHeight = 340;
        if (isFlipped && cardBackInnerRef.current) {
          const cardH = Math.max(340, cardBackInnerRef.current.scrollHeight);
          if (selectedOption !== null) {
            // Step 3 (出答案): 将卡片高度 + 间距 + 底部操作按钮高度作为一个整体参与垂直居中
            const buttonsHeight = (actionButtonsRef.current && actionButtonsRef.current.offsetHeight) ? actionButtonsRef.current.offsetHeight : 44;
            const totalContentHeight = cardH + gapPx + buttonsHeight;
            let margin = (space - totalContentHeight) / 2 - gapPx;
            setCalculatedMarginTop(Math.max(0, margin));
            return;
          } else {
            // Step 2 (待作答): 居中背面选项卡片
            currentHeight = cardH;
          }
        }

        let margin = (space - currentHeight) / 2 - gapPx;
        setCalculatedMarginTop(Math.max(0, margin));
      }
    };
    
    setTimeout(calcMargin, 40);
    window.addEventListener('resize', calcMargin);
    
    const observer = new ResizeObserver(calcMargin);
    if (headerRef.current) observer.observe(headerRef.current);
    if (modeBarRef.current) observer.observe(modeBarRef.current);
    if (cardBackInnerRef.current) observer.observe(cardBackInnerRef.current);
    if (actionButtonsRef.current) observer.observe(actionButtonsRef.current);
    
    return () => {
      window.removeEventListener('resize', calcMargin);
      observer.disconnect();
    };
  }, [isFlipped, selectedOption, activeMode, currentIndex, isPanelOpen, isSearchOpen]);

  // Safe LocalStorage helpers
  const safeStorage = {
    get: (key) => {
      try { return localStorage.getItem(key); } catch (e) { return null; }
    },
    set: (key, val) => {
      try { localStorage.setItem(key, val); } catch (e) { console.warn('LocalStorage save failed:', e); }
    },
    remove: (key) => {
      try { localStorage.removeItem(key); } catch (e) {}
    }
  };

  useEffect(() => {
    safeStorage.set('bj-shizheng-random', String(isRandom));
  }, [isRandom]);

  useEffect(() => {
    safeStorage.set('bj-shizheng-active-mode', activeMode);
  }, [activeMode]);

  // Load from local storage or initial dataset
  useEffect(() => {
    const storageKey = 'bj-shizheng-status-map-v1';
    const sourceData = initialBeijingShizheng;

    const stored = safeStorage.get(storageKey);
    let statusMap = {};
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (typeof parsed === 'object' && parsed !== null) {
          statusMap = parsed;
        }
      } catch (e) {
        statusMap = {};
      }
    }
    
    const loadedItems = sourceData.map(item => ({
      ...item,
      status: statusMap[item.word] || 'new'
    }));

    setItems(loadedItems);

    const savedIndexKey = `bj-shizheng-current-index_${activeMode}`;
    const savedIndex = safeStorage.get(savedIndexKey);
    
    if (savedIndex !== null) {
      const parsed = parseInt(savedIndex, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed < loadedItems.length) {
        setCurrentIndex(parsed);
      } else {
        setCurrentIndex(0);
      }
    } else {
      setCurrentIndex(0);
    }
    
    setSelectedCategory('all');
    setFilter('all');
    setHistory([]);
    setIsFlipped(false);
    setSelectedOption(null);
  }, [activeMode]);

  // Update stats & save status map
  useEffect(() => {
    if (items.length > 0) {
      const known = items.filter(i => i.status === 'known').length;
      const unsure = items.filter(i => i.status === 'unsure').length;
      const unknown = items.filter(i => i.status === 'unknown').length;
      setStats({ known, unsure, unknown });
      
      const storageKey = 'bj-shizheng-status-map-v1';
      const statusMap = {};
      items.forEach(i => {
        if (i.status && i.status !== 'new') {
          statusMap[i.word] = i.status;
        }
      });
      safeStorage.set(storageKey, JSON.stringify(statusMap));
    }
  }, [items]);

  // Filtered by chapter / group
  const currentCategoryItems = items.filter(item => {
    if (selectedCategory === 'all') return true;
    return item.group === selectedCategory || item.chapter === selectedCategory;
  });

  // 🔍 搜索结果去重
  const searchMatchedSentences = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.trim().toLowerCase();
    const map = new Map();

    const targetList = items.filter(item => {
      if (selectedCategory === 'all') return true;
      return item.group === selectedCategory;
    });

    for (const item of targetList) {
      const w = (item.word || '').toLowerCase();
      const m = (item.meaning || '').toLowerCase();
      const h = (item.hint || '').toLowerCase();
      
      const matches = w.includes(q) || m.includes(q) || h.includes(q);
      if (matches) {
        const sentenceKey = (item.meaning || item.word || '').trim();
        if (!map.has(sentenceKey)) {
          map.set(sentenceKey, {
            id: sentenceKey,
            chapter: item.chapter,
            group: item.group,
            subcategory: item.subcategory,
            meaning: item.meaning,
            words: item.word ? [item.word] : [],
          });
        } else {
          const existing = map.get(sentenceKey);
          if (item.word && !existing.words.includes(item.word)) {
            existing.words.push(item.word);
          }
        }
      }
    }
    return Array.from(map.values());
  }, [items, searchQuery, selectedCategory]);

  const safeIndex = (currentCategoryItems.length > 0 && currentIndex >= currentCategoryItems.length) ? 0 : currentIndex;
  const currentItem = inspectingSearchItem || currentCategoryItems[safeIndex] || (currentCategoryItems.length > 0 ? currentCategoryItems[0] : null);

  // Category switch
  useEffect(() => {
    if (currentCategoryItems.length === 0) return;
    
    if (skipCategoryResetRef.current) {
      skipCategoryResetRef.current = false;
      return;
    }

    if (isRandom) {
      setCurrentIndex(Math.floor(Math.random() * currentCategoryItems.length));
    } else {
      setCurrentIndex(0);
    }
    setIsFlipped(false);
    setSelectedOption(null);
  }, [selectedCategory]);

  // Dynamic Height & Auto Scroll into view
  useEffect(() => {
    if (cardBackInnerRef.current) {
      const contentHeight = cardBackInnerRef.current.scrollHeight;
      setCardHeight(`${Math.max(340, contentHeight)}px`);
    }

    if (selectedOption !== null && (activeMode === 'quiz' || activeMode === 'contrast') && isFlipped) {
      const scrollTimer = setTimeout(() => {
        const actionBtnEl = actionButtonsRef.current;
        const floatingBarEl = document.querySelector('.floating-mode-bar');

        if (actionBtnEl && floatingBarEl) {
          const btnRect = actionBtnEl.getBoundingClientRect();
          const floatingRect = floatingBarEl.getBoundingClientRect();

          if (btnRect.bottom > floatingRect.top - 10) {
            const extraScroll = btnRect.bottom - (floatingRect.top - 15);
            window.scrollBy({ top: extraScroll, behavior: 'smooth' });
          }
        }
      }, 80);

      return () => clearTimeout(scrollTimer);
    }
  }, [isFlipped, selectedOption, currentItem, activeMode]);

  // Update example and options when currentItem changes
  useEffect(() => {
    if (!currentItem) return;

    if (currentItem.hint) {
      setCurrentExample(currentItem.hint);
    } else if (currentItem.examples && currentItem.examples.length > 0) {
      setCurrentExample(currentItem.examples[0]);
    } else {
      setCurrentExample(currentItem.meaning || '');
    }

    // Generate options: 1 correct + 3 distractors
    const correctOpt = {
      text: currentItem.word,
      word: currentItem.word,
      isCorrect: true,
      meaning: currentItem.meaning
    };

    let distractorOpts = [];
    if (currentItem.distractors && currentItem.distractors.length > 0) {
      distractorOpts = currentItem.distractors.slice(0, 3).map(d => ({
        text: d.word,
        word: d.word,
        isCorrect: false,
        meaning: d.meaning
      }));
    }

    // If less than 3 distractors, supplement from items
    if (distractorOpts.length < 3) {
      const candidates = items.filter(it => it.word !== currentItem.word && !distractorOpts.some(d => d.word === it.word));
      while (distractorOpts.length < 3 && candidates.length > 0) {
        const randIdx = Math.floor(Math.random() * candidates.length);
        const cand = candidates.splice(randIdx, 1)[0];
        distractorOpts.push({
          text: cand.word,
          word: cand.word,
          isCorrect: false,
          meaning: cand.meaning
        });
      }
    }

    // Shuffle options
    const allOpts = [correctOpt, ...distractorOpts];
    for (let i = allOpts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allOpts[i], allOpts[j]] = [allOpts[j], allOpts[i]];
    }

    setShuffledOptions(allOpts);
    setSelectedOption(null);
    setIsFlipped(false);
  }, [currentItem, items]);

  const handleNext = (status) => {
    if (!currentItem) return;

    if (status === 'known') {
      triggerHaptic('success');
    } else if (status === 'unknown') {
      triggerHaptic('error');
    } else {
      triggerHaptic('tap');
    }

    // 立即翻回正面并重置选项，彻底消除UI滞留与遮挡
    setIsFlipped(false);
    setSelectedOption(null);

    // 如果处于搜索独立预览状态，更新状态后直接关闭预览，返回原进度！
    if (inspectingSearchItem) {
      const realIndex = items.findIndex(i => i.word === inspectingSearchItem.word && i.group === inspectingSearchItem.group);
      if (realIndex !== -1) {
        const updatedItems = [...items];
        updatedItems[realIndex].status = status;
        setItems(updatedItems);
      }
      setInspectingSearchItem(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const realIndex = items.findIndex(i => i.word === currentItem.word && i.group === currentItem.group);
    if (realIndex === -1) return;

    const updatedItems = [...items];
    updatedItems[realIndex].status = status;
    setItems(updatedItems);

    setHistory(prev => [...prev, currentIndex]);

    setTimeout(() => {
      let nextIndex = currentIndex;
      let activeFilter = filter;

      const updatedCategoryItems = updatedItems.filter(item => {
        if (selectedCategory === 'all') return true;
        return item.group === selectedCategory || item.chapter === selectedCategory;
      });

      let candidates = [];
      if (filter !== 'all') {
        candidates = updatedCategoryItems
          .map((item, index) => ({ status: item.status, index }))
          .filter(item => item.status === filter)
          .map(item => item.index);
        
        if (candidates.length === 0) {
          activeFilter = 'all';
          setFilter('all');
          alert(`恭喜！你已复习完该分类下的所有考点，系统已自动切回“全部”模式。`);
        }
      }
      
      if (activeFilter === 'all') {
        if (isRandom) {
          const candidateIndices = [];
          updatedCategoryItems.forEach((item, index) => {
            if (item.status !== 'known') {
              candidateIndices.push(index);
            }
          });
          
          if (candidateIndices.length > 0) {
            let finalCandidates = candidateIndices;
            if (candidateIndices.length > 1) {
              finalCandidates = candidateIndices.filter(idx => idx !== currentIndex);
            }
            nextIndex = finalCandidates[Math.floor(Math.random() * finalCandidates.length)];
          } else {
            const allIndices = Array.from({length: updatedCategoryItems.length}, (_, i) => i);
            const otherIndices = allIndices.filter(idx => idx !== currentIndex);
            nextIndex = otherIndices.length > 0 
              ? otherIndices[Math.floor(Math.random() * otherIndices.length)]
              : 0;
          }
        } else {
          let found = false;
          for (let i = 0; i < updatedCategoryItems.length; i++) {
            let checkIndex = (currentIndex + 1 + i) % updatedCategoryItems.length;
            if (updatedCategoryItems[checkIndex].status !== 'known') {
              nextIndex = checkIndex;
              found = true;
              break;
            }
          }
          if (!found) {
            nextIndex = (currentIndex + 1) % updatedCategoryItems.length;
          }
        }
      } else {
        if (isRandom) {
          let finalCandidates = candidates;
          if (candidates.length > 1) {
            finalCandidates = candidates.filter(idx => idx !== currentIndex);
          }
          nextIndex = finalCandidates[Math.floor(Math.random() * finalCandidates.length)];
        } else {
          const nextCandidate = candidates.find(idx => idx > currentIndex);
          nextIndex = nextCandidate !== undefined ? nextCandidate : candidates[0];
        }
      }
      
      setCurrentIndex(nextIndex);
    }, 150);
  };

  const handlePrev = (e) => {
    e.stopPropagation();
    triggerHaptic('tap');
    if (history.length > 0) {
      const prevIndex = history[history.length - 1];
      setHistory(prev => prev.slice(0, -1));
      setCurrentIndex(prevIndex);
      setIsFlipped(false);
      setSelectedOption(null);
    }
  };

  const handleOpenSearch = () => {
    triggerHaptic('menuToggle');
    setIsSearchOpen(true);
  };

  const handleCloseSearch = () => {
    triggerHaptic('clear');
    setIsSearchOpen(false);
    setSearchQuery('');
    setInspectingSearchItem(null);
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'known': return 'rgba(16, 185, 129, 0.8)';
      case 'unsure': return 'rgba(245, 158, 11, 0.8)';
      case 'unknown': return 'rgba(239, 68, 68, 0.8)';
      default: return 'rgba(107, 114, 128, 0.8)';
    }
  };

  if (items.length === 0) return <div className="loading">加载北京时政复习题库中...</div>;

  const total = items.length;

  return (
    <div className="app-container">
      <header className="header" ref={headerRef}>
        <div className="header-nav-bar">
          {/* 左上角：重置当前题库进度 */}
          <button 
            className="header-icon-btn reset-header-btn" 
            title="重置当前题库进度"
            onClick={() => {
              triggerHaptic('dangerReset');
              if(window.confirm('确定要重置《北京时政市情》题库的学习进度吗？')) {
                localStorage.removeItem('bj-shizheng-status-map-v1');
                window.location.reload();
              }
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
            </svg>
          </button>

          {/* 中间：可交互指示胶囊（展开/收起题库与筛选控制面板） */}
          <button 
            className={`header-meta-pill ${isPanelOpen ? 'active' : ''}`}
            onClick={() => {
              triggerHaptic('menuToggle');
              setIsPanelOpen(prev => !prev);
            }}
            title={isPanelOpen ? "收起控制面板" : "展开章节面板"}
          >
            <span className="pill-db-name">🏛️ 北京时政</span>
            <span className="pill-divider">·</span>
            <span className="pill-cat-name">
              {selectedCategory === 'all' ? '全部考点' : (
                selectedCategory.includes('报告') ? '🏛️ 工作报告' :
                selectedCategory.includes('讲话') ? '🎙️ 重要讲话' :
                selectedCategory.includes('1-5') ? '🌸 1-5月时政' :
                selectedCategory.includes('6-10') ? '🍁 6-10月时政' :
                selectedCategory.includes('地理') ? '🗺️ 市情地理' :
                selectedCategory.includes('常识') ? '🏮 历史常识' :
                selectedCategory.slice(0, 6)
              )}
            </span>
            <span className="pill-progress-text">({safeIndex + 1}/{currentCategoryItems.length})</span>
            <span className={`pill-chevron ${isPanelOpen ? 'open' : ''}`}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </span>
          </button>

          {/* 右上角：搜索按钮 */}
          <button 
            className={`header-icon-btn search-header-btn ${(isSearchOpen || searchQuery) ? 'active' : ''}`}
            title="搜索考点原句"
            onClick={() => {
              if (isSearchOpen || searchQuery) {
                handleCloseSearch();
              } else {
                handleOpenSearch();
              }
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </button>
        </div>

        {/* 顶部展开式搜索栏 */}
        {(isSearchOpen || searchQuery.trim() !== '') && (
          <form 
            className="search-bar-box"
            onSubmit={(e) => {
              e.preventDefault();
              e.target.querySelector('input')?.blur();
            }}
          >
            <svg className="search-box-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="search"
              enterKeyHint="search"
              autoFocus
              className="search-box-input"
              placeholder={`搜索北京时政、高频常识考点 (${items.length} 题)...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.target.blur();
                }
              }}
            />
            {searchQuery && (
              <button
                type="button"
                className="search-box-clear"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCloseSearch();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCloseSearch();
                }}
                title="清空搜索"
              >
                ✕
              </button>
            )}
          </form>
        )}

        {/* 沉浸式下拉抽屉面板 */}
        {isPanelOpen && (
          <div className="progress-container panel-drawer-open">
            <div className="stats-row">
              <div className="stats">
                <button 
                  className={`stat-item ${filter === 'known' ? 'active-known' : ''}`}
                  onClick={() => setFilter(filter === 'known' ? 'all' : 'known')}
                  title="只复习已掌握"
                >
                  <span className="dot dot-known"></span>
                  已掌握: <span className="stat-count">{stats.known}</span>
                </button>

                <button 
                  className={`stat-item ${filter === 'unsure' ? 'active-unsure' : ''}`}
                  onClick={() => setFilter(filter === 'unsure' ? 'all' : 'unsure')}
                  title="只复习模糊"
                >
                  <span className="dot dot-unsure"></span>
                  模糊: <span className="stat-count">{stats.unsure}</span>
                </button>

                <button 
                  className={`stat-item ${filter === 'unknown' ? 'active-unknown' : ''}`}
                  onClick={() => setFilter(filter === 'unknown' ? 'all' : 'unknown')}
                  title="只复习生词"
                >
                  <span className="dot dot-unknown"></span>
                  生词: <span className="stat-count">{stats.unknown}</span>
                </button>

                <button 
                  className={`stat-item ${filter === 'all' ? 'active-all' : ''}`}
                  onClick={() => {
                    triggerHaptic('optionSelect');
                    setFilter('all');
                  }}
                  title="查看全部"
                >
                  总计: <span className="stat-count">{total}</span>
                </button>
              </div>
            </div>

            {/* 单行横向滑动章节栏 */}
            <div className="category-scroll-container">
              <div className="category-scroll-track">
                {[
                  { key: 'all', label: '全部考点' },
                  { key: '【2026政府工作报告】', label: '🏛️ 2026政府工作报告' },
                  { key: '【总书记在京讲话】', label: '🎙️ 总书记在京讲话' },
                  { key: '【1-5月时政精选】', label: '🌸 1-5月时政精选' },
                  { key: '【6-10月时政精选】', label: '🍁 6-10月时政精选' },
                  { key: '【市情市况与地理】', label: '🗺️ 市情市况与地理' },
                  { key: '【历史文化与常识】', label: '🏮 历史文化与常识30条' },
                ].map(cat => (
                  <button
                    key={cat.key}
                    className={`cat-chip ${selectedCategory === cat.key ? 'active' : ''}`}
                    onClick={() => {
                      triggerHaptic('optionSelect');
                      setSelectedCategory(cat.key);
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="main-content">
        {searchQuery.trim() !== '' ? (
          <div className="search-knowledge-view">
            <div className="search-results-bar">
              <span className="search-count-text">
                共匹配到 <strong>{searchMatchedSentences.length}</strong> 条北京考点原句
              </span>
              <button className="search-clear-action-btn" onClick={handleCloseSearch}>
                清空搜索
              </button>
            </div>

            {searchMatchedSentences.length === 0 ? (
              <div className="empty-state-card">
                <h3>未找到匹配考点</h3>
                <p>请尝试缩短关键词，或切换上方全部考点分类</p>
                <button className="empty-state-btn" onClick={handleCloseSearch}>
                  清空搜索
                </button>
              </div>
            ) : (
              <div className="knowledge-cards-list">
                {searchMatchedSentences.map((sent, idx) => (
                  <KnowledgeSentenceCard
                    key={`${sent.id}-${idx}`}
                    sentenceItem={sent}
                    searchQuery={searchQuery}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* 卡片模式：挖空特训 & 易混辨析 */}
            {(activeMode === 'quiz' || activeMode === 'contrast') && (
              <>
                <div 
                  className={`card-container ${selectedOption !== null ? 'expanded' : ''}`} 
                  style={{ 
                    height: isFlipped ? cardHeight : '340px', 
                    marginTop: `${calculatedMarginTop}px` 
                  }} 
                  onClick={() => { 
                    triggerHaptic('cardFlip'); 
                    setIsFlipped(!isFlipped); 
                  }}
                >
                  <div className={`card ${isFlipped ? 'flipped' : ''}`}>
                    {/* 卡片正面 */}
                    <div className="card-front">
                      <div className="card-top-bar">
                        <div className="group-tag" style={{ margin: 0 }}>
                          {currentItem.group} · {currentItem.subcategory || ''}
                        </div>
                        {currentItem.status !== 'new' && (
                          <div className="status-badge-inline" style={{ backgroundColor: getStatusColor(currentItem.status) }}>
                            上次标记: {currentItem.status === 'known' ? '认识' : currentItem.status === 'unsure' ? '模糊' : '不认识'}
                          </div>
                        )}
                      </div>
                      
                      <div className="card-front-center-content">
                        {activeMode === 'quiz' ? (
                          <h2 className="idiom-word sentence-blank" style={{ margin: 0, width: '100%', textAlign: 'justify', lineHeight: '1.65' }}>
                            {renderSentenceWithBlank(currentExample || currentItem.meaning, currentItem.word)}
                          </h2>
                        ) : (
                          <div className="contrast-front-container" style={{ width: '100%' }}>
                            <h2 className="contrast-front-title">
                              【{currentItem.word}】
                            </h2>
                            <div className="contrast-front-sub">
                              请辨析【{currentItem.word}】在首都发展中的政策定位与精准表述
                            </div>
                          </div>
                        )}
                        <div className="card-hint" style={{ marginTop: '1.25rem', width: '100%', textAlign: 'center' }}>
                          点击翻转查看{activeMode === 'quiz' ? '备选考点词' : '辨析选项'}
                        </div>
                      </div>
                    </div>

                    {/* 卡片反面 */}
                    <div className="card-back">
                      <div className="card-back-inner" ref={cardBackInnerRef}>
                        <div className="group-tag">
                          {currentItem.group} · {currentItem.subcategory || ''}
                        </div>
                        <div className="card-back-content">
                          {activeMode === 'quiz' ? (
                            <>
                              <div className="sentence-question">
                                {renderSentenceWithBlank(currentExample || currentItem.meaning, currentItem.word)}
                              </div>
                              <div className="quiz-title">请选择正确的考点填空：</div>
                            </>
                          ) : (
                            <>
                              <h3 style={{ marginBottom: '0.4rem', color: 'var(--text-primary)' }}>【{currentItem.word}】</h3>
                              <div className="sentence-question contrast-question-title" style={{ fontSize: '0.98rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '1rem', textAlign: 'left', lineHeight: '1.45' }}>
                                请选择与【{currentItem.word}】精准对应的官方权威表述：
                              </div>
                            </>
                          )}

                          <div className={`options-container ${activeMode === 'quiz' ? 'options-grid-2x2' : 'options-vertical-contrast'} ${selectedOption === null ? 'quiz-not-answered' : ''}`}>
                            {shuffledOptions.map((opt, index) => {
                              let btnClass = "option-btn";
                              if (selectedOption !== null) {
                                if (opt.isCorrect) {
                                  btnClass += " correct";
                                } else if (selectedOption === index) {
                                  btnClass += " incorrect";
                                }
                                btnClass += " disabled";
                              }

                              return (
                                <button
                                  key={index}
                                  className={btnClass}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (selectedOption === null) {
                                      if (opt.isCorrect) {
                                        triggerHaptic('success');
                                      } else {
                                        triggerHaptic('error');
                                      }
                                      setSelectedOption(index);
                                    }
                                  }}
                                  disabled={selectedOption !== null}
                                >
                                  <span className="option-label">
                                    {selectedOption !== null && opt.isCorrect ? '✓ ' : selectedOption !== null && selectedOption === index ? '✗ ' : `${['A', 'B', 'C', 'D'][index]}. `}
                                  </span>
                                  <span className={activeMode === 'quiz' ? 'option-text-word' : 'option-text'}>{opt.text}</span>
                                </button>
                              );
                            })}
                          </div>

                          {/* 挖空特训作答反馈 */}
                          {activeMode === 'quiz' && selectedOption !== null && (
                            <div className="quiz-feedback-details">
                              <div className="example-item highlighted-example">
                                <strong>🎯 官方原文：</strong>
                                <span>
                                  {renderHighlightedSentence(currentExample || currentItem.meaning, currentItem.word)}
                                </span>
                              </div>
                              {selectedOption !== null && !shuffledOptions[selectedOption]?.isCorrect && (
                                <div className="incorrect-choice-tip">
                                  你误选了 <strong>【{shuffledOptions[selectedOption]?.word}】</strong>，正确考点应为 <strong>【{currentItem.word}】</strong>
                                </div>
                              )}
                            </div>
                          )}

                          {/* 易混辨析作答反馈：权威对照解析 */}
                          {activeMode === 'contrast' && selectedOption !== null && (
                            <div className="contrast-feedback-details">
                              <div className="explanation-title">💡 易混考点权威辨析：</div>
                              <div className="contrast-explanation-list">
                                <div className="contrast-exp-item main-exp">
                                  <span className="exp-badge correct-badge">正确考点</span>
                                  <strong className="exp-word">【{currentItem.word}】</strong>：
                                  <span className="exp-meaning">{currentItem.meaning}</span>
                                </div>
                                {currentItem.distractors && currentItem.distractors.map((d, dIdx) => (
                                  <div key={dIdx} className="contrast-exp-item distractor-exp">
                                    <span className="exp-badge dist-badge">干扰项</span>
                                    <strong className="exp-word">【{d.word}】</strong>：
                                    <span className="exp-meaning">{d.meaning}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 底部操作按钮 */}
                <div 
                  ref={actionButtonsRef}
                  className={`action-buttons ${(!isFlipped || selectedOption === null) ? 'hidden' : ''}`}
                >
                  <button className="btn btn-prev" onClick={handlePrev} disabled={history.length === 0}>
                    上一题
                  </button>
                  <button className="btn btn-unknown" onClick={(e) => { e.stopPropagation(); handleNext('unknown'); }}>
                    不认识
                  </button>
                  <button className="btn btn-unsure" onClick={(e) => { e.stopPropagation(); handleNext('unsure'); }}>
                    模糊
                  </button>
                  <button className="btn btn-known" onClick={(e) => { e.stopPropagation(); handleNext('known'); }}>
                    认识
                  </button>
                </div>
              </>
            )}

            {/* 扩展模式：速览速记 */}
            {activeMode === 'speed' && (
              <div className="list-mode-container">
                <div className="list-mode-header">
                  <h3>速览速记 - {currentCategoryItems.length} 个考点</h3>
                  <button className="toggle-mask-btn" onClick={() => setHideBlanksInSpeedMode(!hideBlanksInSpeedMode)}>
                    {hideBlanksInSpeedMode ? '揭晓全部' : '遮挡考点'}
                  </button>
                </div>
                {currentCategoryItems.map((item, idx) => (
                  <SpeedItemCard 
                    key={`${item.word}-${idx}`} 
                    item={item} 
                    idx={idx} 
                    globalMasked={hideBlanksInSpeedMode} 
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* 底部悬浮模式栏（极简单层设计，无多层套娃） */}
      <nav className="floating-mode-bar" ref={modeBarRef}>
        <button className={`mode-btn ${activeMode === 'quiz' ? 'active' : ''}`} onClick={() => { triggerHaptic('optionSelect'); setActiveMode('quiz'); }}>
          挖空特训
        </button>
        <button className={`mode-btn ${activeMode === 'contrast' ? 'active' : ''}`} onClick={() => { triggerHaptic('optionSelect'); setActiveMode('contrast'); }}>
          易混辨析
        </button>
        <button className={`mode-btn ${activeMode === 'speed' ? 'active' : ''}`} onClick={() => { triggerHaptic('optionSelect'); setActiveMode('speed'); }}>
          速览速记
        </button>

        <span className="mode-divider"></span>

        <button className={`mode-btn random-btn ${!isRandom ? 'active' : ''}`} onClick={() => { triggerHaptic('optionSelect'); setIsRandom(false); }}>
          顺序
        </button>
        <button className={`mode-btn random-btn ${isRandom ? 'active' : ''}`} onClick={() => { triggerHaptic('optionSelect'); setIsRandom(true); }}>
          随机
        </button>
      </nav>
    </div>
  );
}

export default App;
