"use client";

import { useCallback, useEffect, useState } from "react";
import { useMiniApp } from "@neynar/react";
import { Button } from "~/components/ui/Button";
import { ShareButton } from "~/components/ui/Share";
import { APP_URL } from "~/lib/constants";

interface Friend {
  user: {
    fid: number;
    username: string;
    display_name: string;
    pfp_url: string;
  };
}

interface Cast {
  hash: string;
  text: string;
  author: {
    fid: number;
    username: string;
    display_name: string;
    pfp_url: string;
  };
  timestamp: string;
}

interface QuizQuestion {
  cast: Cast;
  correctFriend: Friend;
  options: Friend[];
}

interface GameState {
  selectedFriends: Friend[];
  questions: QuizQuestion[];
  currentQuestionIndex: number;
  score: number;
  gameStarted: boolean;
  gameFinished: boolean;
  answers: { [key: string]: number }; // cast hash -> selected friend fid
}

export default function WhoCast() {
  const { isSDKLoaded, context } = useMiniApp();
  const [gameState, setGameState] = useState<GameState>({
    selectedFriends: [],
    questions: [],
    currentQuestionIndex: 0,
    score: 0,
    gameStarted: false,
    gameFinished: false,
    answers: {},
  });
  const [following, setFollowing] = useState<Friend[]>([]);
  const [filteredFollowing, setFilteredFollowing] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's following list
  useEffect(() => {
    const fetchFollowing = async () => {
      if (!context?.user?.fid) {
        console.log("No context or FID available, skipping fetch");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/following?limit=100&fid=${context.user.fid}`
        );

        if (!response.ok) {
          const errorData = await response.json();
          console.error(`Following API error:`, errorData);
          throw new Error(
            `Failed to fetch following: ${
              errorData.error || response.statusText
            }`
          );
        }

        const data = await response.json();
        setFollowing(data.following || []);
      } catch (err) {
        console.error("Error fetching following:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load your friends"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchFollowing();
  }, [context?.user?.fid]);

  // Filter friends based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredFollowing(following);
    } else {
      const filtered = following.filter(
        (friend) =>
          friend.user.display_name
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          friend.user.username.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredFollowing(filtered);
    }
  }, [following, searchQuery]);

  // Generate quiz questions
  const generateQuiz = useCallback(async (selectedFriends: Friend[]) => {
    if (selectedFriends.length !== 5) return;

    setLoading(true);
    setError(null);

    try {
      const allCasts: Cast[] = [];

      // Fetch casts for each selected friend
      for (const friend of selectedFriends) {
        const response = await fetch(
          `/api/casts?fid=${friend.user.fid}&limit=10`
        );
        if (!response.ok) continue;

        const data = await response.json();
        const friendCasts = data.casts || [];

        // Add friend info to each cast
        const castsWithAuthor = friendCasts.map(
          (cast: { text: string; hash: string; timestamp: string }) => ({
            ...cast,
            author: {
              fid: friend.user.fid,
              username: friend.user.username,
              display_name: friend.user.display_name,
              pfp_url: friend.user.pfp_url,
            },
          })
        );

        allCasts.push(...castsWithAuthor);
      }

      // Filter out casts that are too short or too long
      const validCasts = allCasts.filter(
        (cast) => cast.text.length > 20 && cast.text.length < 200
      );

      if (validCasts.length < 10) {
        setError("Not enough casts found. Please try again.");
        return;
      }

      // Shuffle and take 10 random casts
      const shuffledCasts = validCasts
        .sort(() => Math.random() - 0.5)
        .slice(0, 10);

      // Generate questions
      const questions: QuizQuestion[] = shuffledCasts.map((cast) => {
        const correctFriend = selectedFriends.find(
          (f) => f.user.fid === cast.author.fid
        )!;

        // Create options with correct answer + 4 random friends
        const otherFriends = selectedFriends.filter(
          (f) => f.user.fid !== cast.author.fid
        );
        const randomFriends = otherFriends
          .sort(() => Math.random() - 0.5)
          .slice(0, 4);

        const options = [correctFriend, ...randomFriends].sort(
          () => Math.random() - 0.5
        );

        return {
          cast,
          correctFriend,
          options,
        };
      });

      setGameState((prev) => ({
        ...prev,
        questions,
        gameStarted: true,
        currentQuestionIndex: 0,
        score: 0,
        answers: {},
      }));
    } catch (err) {
      setError("Failed to generate quiz");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle friend selection
  const toggleFriend = useCallback((friend: Friend) => {
    setGameState((prev) => {
      const isSelected = prev.selectedFriends.some(
        (f) => f.user.fid === friend.user.fid
      );

      if (isSelected) {
        return {
          ...prev,
          selectedFriends: prev.selectedFriends.filter(
            (f) => f.user.fid !== friend.user.fid
          ),
        };
      } else if (prev.selectedFriends.length < 5) {
        return {
          ...prev,
          selectedFriends: [...prev.selectedFriends, friend],
        };
      }

      return prev;
    });
  }, []);

  // Handle answer selection
  const selectAnswer = useCallback(
    (selectedFriend: Friend) => {
      const currentQuestion =
        gameState.questions[gameState.currentQuestionIndex];
      if (!currentQuestion) return;

      const isCorrect =
        selectedFriend.user.fid === currentQuestion.correctFriend.user.fid;

      setGameState((prev) => {
        const newAnswers = {
          ...prev.answers,
          [currentQuestion.cast.hash]: selectedFriend.user.fid,
        };

        const newScore = isCorrect ? prev.score + 1 : prev.score;
        const nextQuestionIndex = prev.currentQuestionIndex + 1;
        const gameFinished = nextQuestionIndex >= prev.questions.length;

        return {
          ...prev,
          score: newScore,
          currentQuestionIndex: nextQuestionIndex,
          gameFinished,
          answers: newAnswers,
        };
      });
    },
    [gameState.currentQuestionIndex, gameState.questions]
  );

  // Generate share text with detailed information
  const generateShareText = useCallback(() => {
    if (!gameState.gameFinished || gameState.questions.length === 0) {
      return `I scored ${gameState.score}/${gameState.questions.length} on WhoCast! Can you beat my score? 🎯`;
    }

    // Include usernames with @ for proper tagging
    const friendNames = gameState.selectedFriends
      .map((friend) => `@${friend.user.username}`)
      .join(" ");

    const percentage = Math.round(
      (gameState.score / gameState.questions.length) * 100
    );

    let performanceEmoji = "🎯";
    if (percentage === 100) performanceEmoji = "🏆";
    else if (percentage >= 80) performanceEmoji = "🎉";
    else if (percentage >= 60) performanceEmoji = "👍";
    else performanceEmoji = "🤔";

    // Create a concise version that fits within 320 characters
    const conciseVersion = `🎭 WhoCast: ${gameState.score}/${gameState.questions.length} (${percentage}%) ${performanceEmoji}

👥 Tested with: ${friendNames}

🎮 Play WhoCast and see how well you know your friends!`;

    return conciseVersion;
  }, [gameState]);

  // Reset game
  const resetGame = useCallback(() => {
    setGameState({
      selectedFriends: [],
      questions: [],
      currentQuestionIndex: 0,
      score: 0,
      gameStarted: false,
      gameFinished: false,
      answers: {},
    });
  }, []);

  if (!isSDKLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center relative overflow-hidden">
        {/* Animated background for loading */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
          <div
            className="absolute -bottom-40 -left-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"
            style={{ animationDelay: "2s" }}
          ></div>
          <div
            className="absolute top-40 left-40 w-80 h-80 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"
            style={{ animationDelay: "4s" }}
          ></div>
        </div>

        <div className="text-center relative z-10">
          <div className="relative inline-block mb-8">
            <div className="absolute -inset-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl blur-lg opacity-75 animate-pulse"></div>
            <div className="relative bg-white/10 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border border-purple-400/30">
              <img
                src="/whocastlogo.png"
                alt="WhoCast"
                className="h-16 mx-auto drop-shadow-lg"
              />
            </div>
          </div>

          <h1 className="text-4xl font-black bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent mb-6 tracking-tight">
            WhoCast
          </h1>

          <div className="relative">
            <div className="w-20 h-20 border-4 border-purple-400 border-t-white rounded-full animate-spin mx-auto mb-6"></div>
            <div
              className="absolute inset-0 w-20 h-20 border-4 border-pink-400 border-t-transparent rounded-full animate-spin mx-auto"
              style={{
                animationDirection: "reverse",
                animationDuration: "1.5s",
              }}
            ></div>
          </div>

          <p className="text-white text-xl font-bold mb-4">
            Loading WhoCast...
          </p>
          <p className="text-purple-200 text-sm">
            Preparing your friend knowledge test
          </p>

          <div className="mt-6 flex space-x-2 justify-center">
            <div className="w-3 h-3 bg-purple-400 rounded-full animate-bounce"></div>
            <div
              className="w-3 h-3 bg-pink-400 rounded-full animate-bounce"
              style={{ animationDelay: "0.1s" }}
            ></div>
            <div
              className="w-3 h-3 bg-indigo-400 rounded-full animate-bounce"
              style={{ animationDelay: "0.2s" }}
            ></div>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = gameState.questions[gameState.currentQuestionIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative z-10 mx-auto py-6 px-4 pb-20 max-w-md">
        {/* Header with modern design */}
        <div className="text-center mb-8">
          <div className="relative inline-block mb-6">
            <div className="absolute -inset-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl blur-lg opacity-75 animate-pulse"></div>
            <div className="relative bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-2xl">
              <img
                src="/whocastlogo.png"
                alt="WhoCast"
                className="h-16 mx-auto drop-shadow-lg"
              />
            </div>
          </div>

          <h1 className="text-4xl font-black bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent mb-3 tracking-tight">
            WhoCast
          </h1>

          <p className="text-lg text-purple-200 font-medium mb-2">
            Test Your Friend Knowledge! 🧠
          </p>
          <p className="text-sm text-purple-300/80 leading-relaxed">
            Guess which friend wrote each cast and see how well you know them
          </p>
        </div>

        {error && (
          <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 backdrop-blur-sm border border-red-400/50 rounded-2xl p-6 mb-6 text-center shadow-xl">
            <div className="flex items-center justify-center mb-3">
              <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center mr-3">
                <span className="text-2xl">⚠️</span>
              </div>
              <span className="font-bold text-white text-lg">
                Oops! Something went wrong
              </span>
            </div>
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-purple-400 border-t-white rounded-full animate-spin"></div>
              <div
                className="absolute inset-0 w-20 h-20 border-4 border-pink-400 border-t-transparent rounded-full animate-spin"
                style={{
                  animationDirection: "reverse",
                  animationDuration: "1.5s",
                }}
              ></div>
            </div>
            <p className="mt-6 text-purple-200 font-semibold text-lg">
              Loading your Quiz...
            </p>
            <div className="mt-4 flex space-x-2">
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
              <div
                className="w-2 h-2 bg-pink-400 rounded-full animate-bounce"
                style={{ animationDelay: "0.1s" }}
              ></div>
              <div
                className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                style={{ animationDelay: "0.2s" }}
              ></div>
            </div>
          </div>
        )}

        {/* Friend Selection Screen */}
        {!gameState.gameStarted && !loading && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                <h2 className="text-3xl font-black mb-3 tracking-tight">
                  Select Your Friends
                </h2>
              </div>
              <p className="text-purple-200 font-medium mb-4">
                Choose 5 friends to create your 10-question quiz
              </p>

              {/* Progress indicator */}
              <div className="relative bg-gray-800/50 rounded-full h-3 mb-4 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${(gameState.selectedFriends.length / 5) * 100}%`,
                  }}
                ></div>
              </div>

              <div className="text-sm text-purple-300 font-semibold">
                {gameState.selectedFriends.length}/5 Selected
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg
                  className="h-5 w-5 text-purple-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search friends by name or username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-12 pr-4 py-4 bg-white/10 backdrop-blur-sm border border-purple-400/30 rounded-2xl text-white placeholder-purple-300/70 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all duration-300"
              />
            </div>

            {/* Friends List */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-purple-400/30 overflow-hidden shadow-2xl">
              <div className="max-h-80 overflow-y-auto p-4">
                {filteredFollowing.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-purple-300/70 text-lg font-medium">
                      {searchQuery.trim()
                        ? "No friends found matching your search"
                        : "Loading friends..."}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {filteredFollowing.map((friend) => {
                      const isSelected = gameState.selectedFriends.some(
                        (f) => f.user.fid === friend.user.fid
                      );

                      return (
                        <button
                          key={friend.user.fid}
                          onClick={() => toggleFriend(friend)}
                          disabled={
                            !isSelected && gameState.selectedFriends.length >= 5
                          }
                          className={`group relative flex items-center p-4 rounded-xl border-2 transition-all duration-300 transform hover:scale-105 ${
                            isSelected
                              ? "bg-gradient-to-r from-purple-500/30 to-pink-500/30 border-purple-400 shadow-lg"
                              : "bg-white/5 border-purple-400/20 hover:border-purple-400/50 hover:bg-white/10"
                          } ${
                            !isSelected && gameState.selectedFriends.length >= 5
                              ? "opacity-50 cursor-not-allowed"
                              : "cursor-pointer"
                          }`}
                        >
                          <div className="relative">
                            <img
                              src={friend.user.pfp_url}
                              alt={friend.user.display_name}
                              className="w-14 h-14 rounded-full mr-4 ring-2 ring-purple-400/50 transition-all duration-300 group-hover:ring-purple-400"
                            />
                            {isSelected && (
                              <div className="absolute -top-2 -right-2 w-7 h-7 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                                <span className="text-white text-sm font-bold">
                                  ✓
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="text-left flex-1">
                            <div className="font-bold text-white text-lg">
                              {friend.user.display_name}
                            </div>
                            <div className="text-purple-200 font-medium">
                              @{friend.user.username}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Start Quiz Button */}
            <div className="mt-8">
              <Button
                onClick={() => generateQuiz(gameState.selectedFriends)}
                disabled={gameState.selectedFriends.length < 5}
                className="w-full py-5 text-xl font-black bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transform hover:scale-105 transition-all duration-300 shadow-2xl rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                🚀 Start Quiz ({gameState.selectedFriends.length}/5)
              </Button>
            </div>
          </div>
        )}

        {/* Quiz Game Screen */}
        {gameState.gameStarted &&
          !gameState.gameFinished &&
          currentQuestion &&
          !loading && (
            <div className="space-y-6">
              {/* Game Header */}
              <div className="text-center">
                <div className="flex justify-center items-center space-x-4 mb-6">
                  <div className="bg-gradient-to-r from-purple-500/30 to-pink-500/30 backdrop-blur-sm px-6 py-3 rounded-2xl border border-purple-400/30">
                    <span className="text-white font-bold text-lg">
                      Question {gameState.currentQuestionIndex + 1} of{" "}
                      {gameState.questions.length}
                    </span>
                  </div>
                  <div className="bg-gradient-to-r from-green-500/30 to-blue-500/30 backdrop-blur-sm px-6 py-3 rounded-2xl border border-green-400/30">
                    <span className="text-white font-bold text-lg">
                      Score: {gameState.score}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="relative bg-gray-800/50 rounded-full h-2 mb-6 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${
                        ((gameState.currentQuestionIndex + 1) /
                          gameState.questions.length) *
                        100
                      }%`,
                    }}
                  ></div>
                </div>

                {/* Streak Indicator */}
                <div className="flex justify-center items-center space-x-2 mb-4">
                  <span className="text-purple-200 text-sm font-medium">
                    Current Streak:
                  </span>
                  <div className="flex space-x-1">
                    {Array.from(
                      { length: Math.min(gameState.score, 5) },
                      (_, i) => (
                        <div
                          key={i}
                          className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse"
                        ></div>
                      )
                    )}
                    {Array.from(
                      { length: Math.max(0, 5 - gameState.score) },
                      (_, i) => (
                        <div
                          key={i}
                          className="w-3 h-3 bg-gray-600 rounded-full"
                        ></div>
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* Cast Card */}
              <div className="bg-white/10 backdrop-blur-sm border-2 border-purple-400/30 rounded-2xl p-6 shadow-2xl">
                <div className="text-center mb-4">
                  <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">
                    Cast Text
                  </span>
                </div>
                <div className="bg-white/5 rounded-xl p-4 border border-purple-400/20">
                  <p className="text-xl leading-relaxed text-white font-medium italic">
                    &ldquo;{currentQuestion.cast.text}&rdquo;
                  </p>
                </div>
              </div>

              {/* Question */}
              <div className="text-center">
                <h3 className="text-2xl font-black text-white mb-3">
                  Who wrote this cast? 🤔
                </h3>
                <p className="text-purple-200 font-medium">
                  Tap on the friend you think wrote this cast
                </p>
              </div>

              {/* Answer Options */}
              <div className="space-y-4">
                {currentQuestion.options.map((friend) => (
                  <button
                    key={friend.user.fid}
                    onClick={() => selectAnswer(friend)}
                    className="group flex items-center w-full p-5 rounded-2xl border-2 border-purple-400/30 hover:border-purple-400 hover:bg-white/10 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-2xl"
                  >
                    <div className="relative">
                      <img
                        src={friend.user.pfp_url}
                        alt={friend.user.display_name}
                        className="w-16 h-16 rounded-full mr-5 ring-2 ring-purple-400/50 transition-all duration-300 group-hover:ring-purple-400"
                      />
                      <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-300 blur-sm"></div>
                    </div>
                    <div className="text-left flex-1">
                      <div className="font-bold text-white text-xl">
                        {friend.user.display_name}
                      </div>
                      <div className="text-purple-200 font-medium">
                        @{friend.user.username}
                      </div>
                    </div>
                    <div className="text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <svg
                        className="w-8 h-8"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

        {/* Results Screen */}
        {gameState.gameFinished && !loading && (
          <div className="space-y-8">
            {/* Results Header */}
            <div className="text-center">
              <div className="bg-gradient-to-r from-green-500/30 to-blue-500/30 backdrop-blur-sm rounded-3xl p-8 mb-6 border border-green-400/30 shadow-2xl">
                <h2 className="text-4xl font-black text-white mb-6">
                  Quiz Complete! 🎉
                </h2>
                <div className="text-8xl font-black bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent mb-4 animate-pulse">
                  {gameState.score}/{gameState.questions.length}
                </div>
                <div className="text-2xl text-white font-bold mb-3">
                  {Math.round(
                    (gameState.score / gameState.questions.length) * 100
                  )}
                  % Accuracy
                </div>

                {/* Achievement Badge */}
                <div className="mb-4">
                  {gameState.score === gameState.questions.length ? (
                    <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-yellow-500/30 to-orange-500/30 rounded-full border border-yellow-400/50">
                      <span className="text-2xl mr-2">🏆</span>
                      <span className="text-yellow-200 font-bold">
                        Perfect Score!
                      </span>
                    </div>
                  ) : gameState.score >= gameState.questions.length * 0.8 ? (
                    <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500/30 to-purple-500/30 rounded-full border border-blue-400/50">
                      <span className="text-2xl mr-2">🎉</span>
                      <span className="text-blue-200 font-bold">
                        Excellent!
                      </span>
                    </div>
                  ) : gameState.score >= gameState.questions.length * 0.6 ? (
                    <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-green-500/30 to-teal-500/30 rounded-full border border-green-400/50">
                      <span className="text-2xl mr-2">👍</span>
                      <span className="text-green-200 font-bold">
                        Good Job!
                      </span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-orange-500/30 to-red-500/30 rounded-full border border-orange-400/50">
                      <span className="text-2xl mr-2">🤔</span>
                      <span className="text-orange-200 font-bold">
                        Keep Trying!
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-purple-200 font-semibold text-lg">
                  {gameState.score === gameState.questions.length
                    ? "Perfect score! 🏆 You're a friend expert!"
                    : gameState.score >= gameState.questions.length * 0.8
                    ? "Great job! 🎉 You know your friends well!"
                    : gameState.score >= gameState.questions.length * 0.6
                    ? "Not bad! 👍 You're getting there!"
                    : "Better luck next time! 🤔 Keep practicing!"}
                </p>
              </div>
            </div>

            {/* Friend Performance Breakdown */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border border-purple-400/30">
              <h3 className="text-2xl font-black text-white mb-6 text-center">
                Friend Performance Breakdown 👥
              </h3>
              <div className="grid grid-cols-1 gap-4">
                {gameState.selectedFriends.map((friend) => {
                  const friendQuestions = gameState.questions.filter(
                    (q) => q.correctFriend.user.fid === friend.user.fid
                  );
                  const correctGuesses = friendQuestions.filter((q) => {
                    const selectedFid = gameState.answers[q.cast.hash];
                    return selectedFid === friend.user.fid;
                  }).length;
                  const totalQuestions = friendQuestions.length;
                  const accuracy =
                    totalQuestions > 0
                      ? Math.round((correctGuesses / totalQuestions) * 100)
                      : 0;

                  return (
                    <div
                      key={friend.user.fid}
                      className="flex items-center p-4 rounded-xl border border-purple-400/30 bg-white/5 backdrop-blur-sm"
                    >
                      <img
                        src={friend.user.pfp_url}
                        alt={friend.user.display_name}
                        className="w-12 h-12 rounded-full mr-4 ring-2 ring-purple-400/50"
                      />
                      <div className="flex-1">
                        <div className="font-bold text-white text-lg">
                          {friend.user.display_name}
                        </div>
                        <div className="text-purple-200 font-medium">
                          @{friend.user.username}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center space-x-3">
                          <span className="text-white font-bold text-lg">
                            {correctGuesses}/{totalQuestions}
                          </span>
                          <span
                            className={`text-2xl font-black ${
                              accuracy === 100
                                ? "text-green-400"
                                : accuracy >= 80
                                ? "text-blue-400"
                                : accuracy >= 60
                                ? "text-yellow-400"
                                : "text-red-400"
                            }`}
                          >
                            {accuracy}%
                          </span>
                        </div>
                        <div className="flex items-center mt-2">
                          {correctGuesses > 0 && (
                            <span className="text-green-400 mr-2 text-lg">
                              ✓
                            </span>
                          )}
                          {totalQuestions - correctGuesses > 0 && (
                            <span className="text-red-400 mr-2 text-lg">✗</span>
                          )}
                          <span className="text-xs text-purple-300">
                            {correctGuesses > 0 && `${correctGuesses} correct`}
                            {correctGuesses > 0 &&
                              totalQuestions - correctGuesses > 0 &&
                              " • "}
                            {totalQuestions - correctGuesses > 0 &&
                              `${totalQuestions - correctGuesses} wrong`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Detailed Answers */}
            <div className="space-y-4">
              <h3 className="font-black text-white text-xl">
                Detailed Answers:
              </h3>
              {gameState.questions.map((question, index) => {
                const selectedFid = gameState.answers[question.cast.hash];
                const isCorrect =
                  selectedFid === question.correctFriend.user.fid;
                const selectedFriend = gameState.selectedFriends.find(
                  (f) => f.user.fid === selectedFid
                );

                return (
                  <div
                    key={question.cast.hash}
                    className={`p-5 rounded-2xl border-2 backdrop-blur-sm ${
                      isCorrect
                        ? "bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-400/50"
                        : "bg-gradient-to-r from-red-500/20 to-pink-500/20 border-red-400/50"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center">
                        <span
                          className={`text-2xl font-black mr-3 ${
                            isCorrect ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {isCorrect ? "✓" : "✗"}
                        </span>
                        <span className="text-purple-200 font-bold">
                          Question {index + 1}
                        </span>
                      </div>
                      <div
                        className={`px-3 py-1 rounded-full text-sm font-bold ${
                          isCorrect
                            ? "bg-green-500/30 text-green-300 border border-green-400/50"
                            : "bg-red-500/30 text-red-300 border border-red-400/50"
                        }`}
                      >
                        {isCorrect ? "Correct" : "Wrong"}
                      </div>
                    </div>

                    <div className="bg-white/5 rounded-xl p-4 mb-4 border border-purple-400/20">
                      <div className="text-purple-200 italic font-medium">
                        &ldquo;{question.cast.text}&rdquo;
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <img
                          src={
                            selectedFriend?.user.pfp_url ||
                            question.correctFriend.user.pfp_url
                          }
                          alt={
                            selectedFriend?.user.display_name ||
                            question.correctFriend.user.display_name
                          }
                          className="w-10 h-10 rounded-full mr-3 ring-2 ring-purple-400/50"
                        />
                        <div>
                          <div className="text-white font-bold">
                            You guessed:{" "}
                            {selectedFriend?.user.display_name || "Unknown"}
                          </div>
                          {!isCorrect && (
                            <div className="text-purple-300 text-sm">
                              Correct:{" "}
                              {question.correctFriend.user.display_name}
                            </div>
                          )}
                        </div>
                      </div>
                      {!isCorrect && (
                        <div className="flex items-center">
                          <img
                            src={question.correctFriend.user.pfp_url}
                            alt={question.correctFriend.user.display_name}
                            className="w-10 h-10 rounded-full mr-2 ring-2 ring-green-400/50"
                          />
                          <span className="text-green-300 text-sm font-medium">
                            {question.correctFriend.user.display_name}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="space-y-4">
              <Button
                onClick={resetGame}
                className="w-full py-5 text-xl font-black bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 transform hover:scale-105 transition-all duration-300 shadow-2xl rounded-2xl"
              >
                🎮 Play Again
              </Button>

              {context?.user?.fid && (
                <ShareButton
                  buttonText="📤 Share My Results"
                  cast={{
                    text: generateShareText(),
                    embeds: [
                      {
                        path: "/",
                        url: APP_URL || "https://whocast.vercel.app",
                      },
                    ],
                  }}
                  className="w-full py-5 text-xl font-black bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 transform hover:scale-105 transition-all duration-300 shadow-2xl rounded-2xl"
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Custom CSS for animations */}
      <style jsx>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}
