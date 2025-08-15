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
      .map((friend) => `${friend.user.display_name} (@${friend.user.username})`)
      .join(", ");

    const percentage = Math.round(
      (gameState.score / gameState.questions.length) * 100
    );

    let performanceEmoji = "🎯";
    if (percentage === 100) performanceEmoji = "🏆";
    else if (percentage >= 80) performanceEmoji = "🎉";
    else if (percentage >= 60) performanceEmoji = "👍";
    else performanceEmoji = "🤔";

    // Create detailed breakdown of each question
    const questionBreakdown = gameState.questions
      .map((question, index) => {
        const selectedFid = gameState.answers[question.cast.hash];
        const isCorrect = selectedFid === question.correctFriend.user.fid;
        const selectedFriend = gameState.selectedFriends.find(
          (f) => f.user.fid === selectedFid
        );

        return `${index + 1}. ${isCorrect ? "✅" : "❌"} ${
          question.correctFriend.user.display_name
        } (@${question.correctFriend.user.username}) (You guessed: ${
          selectedFriend?.user.display_name || "Unknown"
        })`;
      })
      .join("\n");

    // Create friend performance summary with usernames
    const friendPerformance = gameState.selectedFriends
      .map((friend) => {
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

        return `${friend.user.display_name} (@${friend.user.username}): ${correctGuesses}/${totalQuestions} (${accuracy}%)`;
      })
      .join("\n");

    // Create a longer detailed version
    const detailedVersion = `🎭 WhoCast Results: ${gameState.score}/${gameState.questions.length} (${percentage}%) ${performanceEmoji}

👥 Friends tested: ${friendNames}

📊 Friend Performance:
${friendPerformance}

📝 Question Breakdown:
${questionBreakdown}

🎮 Play WhoCast and see how well you know your friends! Can you beat my score?`;

    // Return the detailed version for comprehensive sharing
    return detailedVersion;
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
      <div className="flex items-center justify-center h-screen">
        Loading...
      </div>
    );
  }

  const currentQuestion = gameState.questions[gameState.currentQuestionIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900">
      <div className="mx-auto py-6 px-4 pb-20">
        <div className="max-w-md mx-auto">
          {/* Header with enhanced styling */}
          <div className="text-center mb-8">
            <div className="relative">
              <img
                src="/whocastlogo.png"
                alt="WhoCast"
                className="h-20 mx-auto mb-4 drop-shadow-lg animate-pulse"
              />
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg blur opacity-20 animate-pulse"></div>
            </div>
            <p className="text-lg text-gray-700 dark:text-gray-300 mb-2 font-medium">
              Test Your Friend Knowledge! 🧠
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Guess which friend wrote each cast and see how well you know them
            </p>
          </div>

          {error && (
            <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-2 border-red-200 dark:border-red-700 rounded-xl p-6 mb-6 text-red-700 dark:text-red-300 text-center shadow-lg">
              <div className="flex items-center justify-center mb-2">
                <span className="text-2xl mr-2">⚠️</span>
                <span className="font-semibold">
                  Oops! Something went wrong
                </span>
              </div>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="relative">
                <div className="animate-spin h-12 w-12 border-4 border-purple-600 border-t-transparent rounded-full" />
                <div
                  className="absolute inset-0 animate-spin h-12 w-12 border-4 border-pink-600 border-t-transparent rounded-full"
                  style={{
                    animationDirection: "reverse",
                    animationDuration: "1.5s",
                  }}
                />
              </div>
              <p className="mt-4 text-gray-600 dark:text-gray-400 font-medium">
                Loading your Quiz...
              </p>
            </div>
          )}

          {/* Friend Selection Screen */}
          {!gameState.gameStarted && !loading && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  <h2 className="text-2xl font-bold mb-2">
                    Select Your Friends
                  </h2>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Choose 5 friends to create your 10-question quiz
                </p>
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                  Selected: {gameState.selectedFriends.length}/5
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400"
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
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                />
              </div>

              {/* Friends List with Fixed Height */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="max-h-64 overflow-y-auto p-2">
                  {filteredFollowing.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-gray-500 dark:text-gray-400 text-sm">
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
                              !isSelected &&
                              gameState.selectedFriends.length >= 5
                            }
                            className={`flex items-center p-4 rounded-xl border-2 transition-all duration-200 transform hover:scale-105 ${
                              isSelected
                                ? "bg-gradient-to-r from-purple-100 to-pink-100 border-purple-400 dark:from-purple-900/30 dark:to-pink-900/30 dark:border-purple-500 shadow-lg"
                                : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-500 hover:shadow-md"
                            } ${
                              !isSelected &&
                              gameState.selectedFriends.length >= 5
                                ? "opacity-50 cursor-not-allowed"
                                : "cursor-pointer"
                            }`}
                          >
                            <div className="relative">
                              <img
                                src={friend.user.pfp_url}
                                alt={friend.user.display_name}
                                className="w-12 h-12 rounded-full mr-4 ring-2 ring-gray-200 dark:ring-gray-700"
                              />
                              {isSelected && (
                                <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                                  <span className="text-white text-xs font-bold">
                                    ✓
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="text-left flex-1">
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {friend.user.display_name}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
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

              <div className="mt-8">
                <Button
                  onClick={() => generateQuiz(gameState.selectedFriends)}
                  disabled={gameState.selectedFriends.length < 5}
                  className="w-full py-4 text-lg font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transform hover:scale-105 transition-all duration-200 shadow-lg"
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
                <div className="text-center">
                  <img
                    src="/whocastlogo.png"
                    alt="WhoCast"
                    className="h-14 mx-auto mb-4 drop-shadow-sm"
                  />
                  <div className="flex justify-center items-center space-x-4 mb-4">
                    <div className="bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 px-4 py-2 rounded-full">
                      <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                        Question {gameState.currentQuestionIndex + 1} of{" "}
                        {gameState.questions.length}
                      </span>
                    </div>
                    <div className="bg-gradient-to-r from-green-100 to-blue-100 dark:from-green-900/30 dark:to-blue-900/30 px-4 py-2 rounded-full">
                      <span className="text-sm font-medium text-green-700 dark:text-green-300">
                        Score: {gameState.score}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-2 border-purple-200 dark:border-purple-700 rounded-xl p-6 shadow-lg">
                  <div className="text-center mb-3">
                    <span className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wide">
                      Cast Text
                    </span>
                  </div>
                  <p className="text-lg leading-relaxed text-gray-800 dark:text-gray-200 font-medium">
                    &ldquo;{currentQuestion.cast.text}&rdquo;
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                      Who wrote this cast? 🤔
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Click on the friend you think wrote this cast
                    </p>
                  </div>
                  {currentQuestion.options.map((friend) => (
                    <button
                      key={friend.user.fid}
                      onClick={() => selectAnswer(friend)}
                      className="flex items-center w-full p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 dark:hover:from-purple-900/20 dark:hover:to-pink-900/20 transition-all duration-200 transform hover:scale-105 shadow-sm hover:shadow-md"
                    >
                      <img
                        src={friend.user.pfp_url}
                        alt={friend.user.display_name}
                        className="w-14 h-14 rounded-full mr-4 ring-2 ring-gray-200 dark:ring-gray-700"
                      />
                      <div className="text-left flex-1">
                        <div className="font-semibold text-gray-900 dark:text-white text-lg">
                          {friend.user.display_name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          @{friend.user.username}
                        </div>
                      </div>
                      <div className="text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg
                          className="w-6 h-6"
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
              <div className="text-center">
                <img
                  src="/whocastlogo.png"
                  alt="WhoCast"
                  className="h-16 mx-auto mb-4 drop-shadow-sm"
                />
                <div className="bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-2xl p-6 mb-4">
                  <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-4">
                    Quiz Complete! 🎉
                  </h2>
                  <div className="text-6xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
                    {gameState.score}/{gameState.questions.length}
                  </div>
                  <div className="text-lg text-gray-600 dark:text-gray-400 mb-2">
                    {Math.round(
                      (gameState.score / gameState.questions.length) * 100
                    )}
                    % Accuracy
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 font-medium">
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
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4 text-center">
                  Friend Performance Breakdown 👥
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  {gameState.selectedFriends.map((friend) => {
                    // Calculate how many times this friend appeared in questions
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
                        className="flex items-center p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50"
                      >
                        <img
                          src={friend.user.pfp_url}
                          alt={friend.user.display_name}
                          className="w-10 h-10 rounded-full mr-3 ring-2 ring-gray-200 dark:ring-gray-700"
                        />
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {friend.user.display_name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            @{friend.user.username}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {correctGuesses}/{totalQuestions}
                            </span>
                            <span
                              className={`text-lg font-bold ${
                                accuracy === 100
                                  ? "text-green-600"
                                  : accuracy >= 80
                                  ? "text-blue-600"
                                  : accuracy >= 60
                                  ? "text-yellow-600"
                                  : "text-red-600"
                              }`}
                            >
                              {accuracy}%
                            </span>
                          </div>
                          <div className="flex items-center mt-1">
                            {correctGuesses > 0 && (
                              <span className="text-green-600 mr-1">✓</span>
                            )}
                            {totalQuestions - correctGuesses > 0 && (
                              <span className="text-red-600 mr-1">✗</span>
                            )}
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {correctGuesses > 0 &&
                                `${correctGuesses} correct`}
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

              <div className="space-y-3">
                <h3 className="font-semibold text-gray-800 dark:text-white">
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
                      className={`p-4 rounded-xl border-2 ${
                        isCorrect
                          ? "bg-gradient-to-r from-green-50 to-emerald-50 border-green-300 dark:from-green-900/20 dark:to-emerald-900/20 dark:border-green-600"
                          : "bg-gradient-to-r from-red-50 to-pink-50 border-red-300 dark:from-red-900/20 dark:to-pink-900/20 dark:border-red-600"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center">
                          <span
                            className={`text-lg font-bold mr-2 ${
                              isCorrect ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {isCorrect ? "✓" : "✗"}
                          </span>
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            Question {index + 1}
                          </span>
                        </div>
                        <div
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            isCorrect
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                          }`}
                        >
                          {isCorrect ? "Correct" : "Wrong"}
                        </div>
                      </div>

                      <div className="bg-white dark:bg-gray-800 rounded-lg p-3 mb-3 border border-gray-200 dark:border-gray-700">
                        <div className="text-sm text-gray-700 dark:text-gray-300 italic">
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
                            className="w-8 h-8 rounded-full mr-2 ring-1 ring-gray-200 dark:ring-gray-700"
                          />
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              You guessed:{" "}
                              {selectedFriend?.user.display_name || "Unknown"}
                            </div>
                            {!isCorrect && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
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
                              className="w-8 h-8 rounded-full mr-2 ring-1 ring-gray-200 dark:ring-gray-700"
                            />
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {question.correctFriend.user.display_name}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-4">
                <Button
                  onClick={resetGame}
                  className="w-full py-4 text-lg font-semibold bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 transform hover:scale-105 transition-all duration-200 shadow-lg"
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
                          url: APP_URL,
                        },
                      ],
                    }}
                    className="w-full py-4 text-lg font-semibold bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 transform hover:scale-105 transition-all duration-200 shadow-lg"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
