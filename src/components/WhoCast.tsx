"use client";

import { useCallback, useEffect, useState } from "react";
import { useMiniApp } from "@neynar/react";
import { Button } from "~/components/ui/Button";
import { ShareButton } from "~/components/ui/Share";
import { Header } from "~/components/ui/Header";
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
  const [allUsers, setAllUsers] = useState<Friend[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetailedAnswers, setShowDetailedAnswers] = useState(false);

  // Fetch all friends (500 users) on component mount with cursor pagination
  useEffect(() => {
    const fetchAllFriends = async () => {
      if (!context?.user?.fid) return;

      setLoading(true);
      setError(null);

      try {
        const allUsers: Friend[] = [];
        let cursor = "";
        let hasMore = true;

        // Fetch 500 users by making API calls with cursor pagination
        while (allUsers.length < 500 && hasMore) {
          const response = await fetch(
            `/api/following?limit=100&fid=${context.user.fid}&cursor=${cursor}`
          );

          if (!response.ok) {
            const errorData = await response.json();
            console.error(`Friends API error:`, errorData);
            throw new Error(
              `Failed to fetch friends: ${
                errorData.error || response.statusText
              }`
            );
          }

          const data = await response.json();
          const userList = data.users || [];

          // Add unique users only (avoid duplicates)
          const uniqueUsers = userList.filter(
            (newUser: Friend) =>
              !allUsers.some(
                (existingUser) => existingUser.user.fid === newUser.user.fid
              )
          );

          allUsers.push(...uniqueUsers);

          // Update cursor for next page
          cursor = data.nextCursor || "";
          hasMore = !!data.nextCursor && userList.length === 100;

          // If we got less than 100 users, we've reached the end
          if (userList.length < 100) break;
        }

        console.log("Total unique friends fetched:", allUsers.length);
        setAllUsers(allUsers);
        setFilteredUsers(allUsers);
      } catch (err) {
        console.error("Error fetching friends:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch friends"
        );
        setFilteredUsers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAllFriends();
  }, [context?.user?.fid]);

  // Filter users based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      // Show all users when no search query
      setFilteredUsers(allUsers);
      setSearching(false);
      return;
    }

    setSearching(true);
    setError(null);

    try {
      const searchLower = searchQuery.toLowerCase();
      const filtered = allUsers.filter(
        (user) =>
          user.user?.username?.toLowerCase().includes(searchLower) ||
          user.user?.display_name?.toLowerCase().includes(searchLower)
      );

      setFilteredUsers(filtered);
    } catch (err) {
      console.error("Error filtering users:", err);
      setError("Failed to filter users");
    } finally {
      setSearching(false);
    }
  }, [searchQuery, allUsers]);

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

      if (validCasts.length < 5) {
        setError("Not enough casts found. Please try again.");
        return;
      }

      // Shuffle and take 5 random casts
      const shuffledCasts = validCasts
        .sort(() => Math.random() - 0.5)
        .slice(0, 5);

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
    const conciseVersion = `WhoCast: ${gameState.score}/${gameState.questions.length} (${percentage}%) ${performanceEmoji}

Tested with: ${friendNames}

 Play WhoCast and see how well you know your friends!`;

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
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Subtle background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#ffcda2] rounded-full mix-blend-multiply filter blur-xl opacity-5 animate-pulse"></div>
        <div
          className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#ffcda2] rounded-full mix-blend-multiply filter blur-xl opacity-5 animate-pulse"
          style={{ animationDelay: "2s" }}
        ></div>
      </div>

      <div className="relative z-10 mx-auto py-2 px-4 pb-24 max-w-sm">
        {/* Header */}
        <Header />

        {error && (
          <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 backdrop-blur-sm border border-red-400/50 rounded-2xl p-6 mb-6 text-center shadow-xl">
            <div className="flex items-center justify-center mb-3">
              <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center mr-3">
                <span className="text-2xl">⚠️</span>
              </div>
              <span className="font-bold text-white text-lg edu-nsw-act-cursive">
                Oops! Something went wrong
              </span>
            </div>
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-cyan-400 border-t-white rounded-full animate-spin"></div>
              <div
                className="absolute inset-0 w-20 h-20 border-4 border-[#ffcda2] border-t-transparent rounded-full animate-spin"
                style={{
                  animationDirection: "reverse",
                  animationDuration: "1.5s",
                }}
              ></div>
            </div>
            <p className="mt-6 text-[#ffcda2] font-semibold text-lg edu-nsw-act-cursive">
              Loading your Quiz...
            </p>
            <div className="mt-4 flex space-x-2">
              <div className="w-2 h-2 bg-[#ffcda2] rounded-full animate-bounce"></div>
              <div
                className="w-2 h-2 bg-[#ffcda2]/80 rounded-full animate-bounce"
                style={{ animationDelay: "0.1s" }}
              ></div>
              <div
                className="w-2 h-2 bg-[#ffcda2]/60 rounded-full animate-bounce"
                style={{ animationDelay: "0.2s" }}
              ></div>
            </div>
          </div>
        )}

        {/* Friend Selection Screen */}
        {!gameState.gameStarted && !loading && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h1 className="edu-nsw-act-cursive text-4xl font-bold text-white mb-2">
                WhoCast
              </h1>
              <p className="text-[#ffcda2] text-sm edu-nsw-act-cursive">
                Test how well you know your friends!
              </p>

              {/* Progress indicator */}
              <div className="relative bg-gray-800/30 rounded-full h-2 mb-3 overflow-hidden mt-4">
                <div
                  className="bg-[#ffcda2] h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${(gameState.selectedFriends.length / 5) * 100}%`,
                  }}
                ></div>
              </div>

              <div className="text-xs text-[#ffcda2]">
                {gameState.selectedFriends.length}/5 Selected
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                <svg
                  className="h-5 w-5 text-[#ffcda2]"
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
                placeholder="Search your friends..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-4 py-3 bg-black/50 backdrop-blur-sm border border-[#ffcda2]/30 rounded-xl text-white placeholder-[#ffcda2]/50 focus:outline-none focus:ring-2 focus:ring-[#ffcda2] focus:border-transparent transition-all duration-200"
              />
            </div>

            {/* Selected Users */}
            {gameState.selectedFriends.length > 0 && (
              <div className="bg-black/50 backdrop-blur-sm rounded-xl border border-[#ffcda2]/30 p-3">
                <h3 className="text-sm font-medium text-white mb-2 edu-nsw-act-cursive">
                  Selected Users:
                </h3>
                <div className="flex flex-wrap gap-2">
                  {gameState.selectedFriends.map((friend) => (
                    <div
                      key={friend.user.fid}
                      className="flex items-center bg-[#ffcda2]/20 rounded-lg px-2 py-1"
                    >
                      <img
                        src={friend.user.pfp_url}
                        alt={friend.user.display_name}
                        className="w-5 h-5 rounded-full mr-2"
                      />
                      <span className="text-xs text-white">
                        {friend.user.username}
                      </span>
                      <button
                        onClick={() => toggleFriend(friend)}
                        className="ml-1 text-[#ffcda2] hover:text-white text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Users List */}
            <div
              className="flex flex-col bg-black/50 backdrop-blur-sm rounded-xl border border-[#ffcda2]/30 overflow-hidden"
              style={{ height: "calc(100vh - 300px)" }}
            >
              <div className="flex-1 overflow-y-auto p-3">
                {searching ? (
                  <div className="text-center py-8">
                    <div className="animate-spin h-6 w-6 border-2 border-[#ffcda2] border-t-transparent rounded-full mx-auto mb-3"></div>
                    <div className="text-[#ffcda2] text-sm edu-nsw-act-cursive">
                      Searching...
                    </div>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-[#ffcda2] text-sm edu-nsw-act-cursive">
                      {searchQuery.trim()
                        ? "No users found"
                        : "Type to search your friends..."}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {filteredUsers.map((friend) => {
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
                          className={`group relative flex items-center p-3 rounded-lg border transition-all duration-200 ${
                            isSelected
                              ? "bg-[#ffcda2]/20 border-[#ffcda2]"
                              : "bg-black/30 border-[#ffcda2]/30 hover:border-[#ffcda2]/50 hover:bg-black/50"
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
                              className="w-10 h-10 rounded-full mr-3 ring-1 ring-[#ffcda2]/30"
                            />
                            {isSelected && (
                              <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#ffcda2] rounded-full flex items-center justify-center">
                                <span className="text-black text-xs font-bold">
                                  ✓
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="text-left flex-1 min-w-0">
                            <div className="font-medium text-white text-sm truncate">
                              {friend.user.display_name}
                            </div>
                            <div className="text-[#ffcda2] text-xs truncate">
                              @{friend.user.username}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {!gameState.gameStarted && !loading && (
                <div className="p-3 border-t border-[#ffcda2]/20">
                  <Button
                    onClick={() => generateQuiz(gameState.selectedFriends)}
                    disabled={gameState.selectedFriends.length < 5}
                    className="w-full py-3 text-lg font-bold bg-[#ffcda2] hover:bg-[#ffcda2]/80 text-black transition-all duration-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-lg edu-nsw-act-cursive"
                  >
                    Start Quiz ({gameState.selectedFriends.length}/5)
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Start Quiz Button - Fixed at Bottom */}

        {/* Quiz Game Screen */}
        {gameState.gameStarted &&
          !gameState.gameFinished &&
          currentQuestion &&
          !loading && (
            <div className="space-y-6">
              {/* Game Header */}
              <div className="text-center">
                <div className="flex justify-center items-center space-x-3 mb-4">
                  <div className="bg-black/50 backdrop-blur-sm px-4 py-2 rounded-lg border border-[#ffcda2]/30">
                    <span className="text-white font-medium text-sm edu-nsw-act-cursive">
                      {gameState.currentQuestionIndex + 1} /{" "}
                      {gameState.questions.length}
                    </span>
                  </div>
                  <div className="bg-black/50 backdrop-blur-sm px-4 py-2 rounded-lg border border-[#ffcda2]/30">
                    <span className="text-white font-medium text-sm edu-nsw-act-cursive">
                      Score: {gameState.score}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="relative bg-gray-800/50 rounded-full h-1 mb-4 overflow-hidden">
                  <div
                    className="bg-[#ffcda2] h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${
                        ((gameState.currentQuestionIndex + 1) /
                          gameState.questions.length) *
                        100
                      }%`,
                    }}
                  ></div>
                </div>
              </div>

              {/* Cast Card */}
              <div className="bg-black/50 backdrop-blur-sm border border-[#ffcda2]/30 rounded-xl p-4 shadow-lg">
                <div className="text-center mb-3">
                  <span className="text-xs font-medium text-[#ffcda2] uppercase tracking-wider edu-nsw-act-cursive">
                    Cast
                  </span>
                </div>
                <div className="bg-black/30 rounded-lg p-3 border border-[#ffcda2]/20">
                  <p className="text-lg leading-relaxed text-white font-medium italic">
                    &ldquo;{currentQuestion.cast.text}&rdquo;
                  </p>
                </div>
              </div>

              {/* Question */}
              <div className="text-center">
                <h3 className="text-xl font-bold text-white mb-2 edu-nsw-act-cursive">
                  Who wrote this cast?
                </h3>
                <p className="text-[#ffcda2] font-medium text-sm edu-nsw-act-cursive">
                  Tap on the friend you think wrote this cast
                </p>
              </div>

              {/* Answer Options */}
              <div className="space-y-4">
                {currentQuestion.options.map((friend) => (
                  <button
                    key={friend.user.fid}
                    onClick={() => selectAnswer(friend)}
                    className="group flex items-center w-full p-4 rounded-lg border border-[#ffcda2]/30 hover:border-[#ffcda2] hover:bg-black/30 transition-all duration-300 transform hover:scale-102 shadow-md hover:shadow-lg"
                  >
                    <div className="relative">
                      <img
                        src={friend.user.pfp_url}
                        alt={friend.user.display_name}
                        className="w-12 h-12 rounded-full mr-4 ring-1 ring-[#ffcda2]/50 transition-all duration-300 group-hover:ring-[#ffcda2]"
                      />
                      <div className="absolute -inset-1 bg-[#ffcda2] rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-300 blur-sm"></div>
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <div className="font-bold text-white text-lg truncate edu-nsw-act-cursive">
                        {friend.user.display_name}
                      </div>
                      <div className="text-[#ffcda2] font-medium truncate text-sm">
                        @{friend.user.username}
                      </div>
                    </div>
                    <div className="text-[#ffcda2] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
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
              <div className="bg-black/50 backdrop-blur-sm rounded-xl p-6 mb-6 border border-[#ffcda2]/30 shadow-lg">
                <h2 className="text-3xl font-bold text-white mb-4 edu-nsw-act-cursive">
                  Quiz Complete!
                </h2>
                <div className="text-6xl font-bold text-[#ffcda2] mb-3 animate-pulse edu-nsw-act-cursive">
                  {gameState.score}/{gameState.questions.length}
                </div>
                <div className="text-xl text-white font-bold mb-3 edu-nsw-act-cursive">
                  {Math.round(
                    (gameState.score / gameState.questions.length) * 100
                  )}
                  % Accuracy
                </div>

                {/* Achievement Badge */}
                <div className="mb-4">
                  {gameState.score === gameState.questions.length ? (
                    <div className="inline-flex items-center px-4 py-2 bg-[#ffcda2]/20 rounded-full border border-[#ffcda2]/50">
                      <span className="text-[#ffcda2] font-bold edu-nsw-act-cursive">
                        Perfect Score!
                      </span>
                    </div>
                  ) : gameState.score >= gameState.questions.length * 0.8 ? (
                    <div className="inline-flex items-center px-4 py-2 bg-[#ffcda2]/20 rounded-full border border-[#ffcda2]/50">
                      <span className="text-[#ffcda2] font-bold edu-nsw-act-cursive">
                        Excellent!
                      </span>
                    </div>
                  ) : gameState.score >= gameState.questions.length * 0.6 ? (
                    <div className="inline-flex items-center px-4 py-2 bg-[#ffcda2]/20 rounded-full border border-[#ffcda2]/50">
                      <span className="text-[#ffcda2] font-bold edu-nsw-act-cursive">
                        Good Job!
                      </span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center px-4 py-2 bg-[#ffcda2]/20 rounded-full border border-[#ffcda2]/50">
                      <span className="text-[#ffcda2] font-bold edu-nsw-act-cursive">
                        Keep Trying!
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-[#ffcda2] font-semibold text-lg edu-nsw-act-cursive">
                  {gameState.score === gameState.questions.length
                    ? "Perfect score! You're a friend expert!"
                    : gameState.score >= gameState.questions.length * 0.8
                    ? "Great job! You know your friends well!"
                    : gameState.score >= gameState.questions.length * 0.6
                    ? "Not bad! You're getting there!"
                    : "Better luck next time! Keep Playing!"}
                </p>
              </div>
            </div>

            {/* Friend Performance Breakdown */}

            {/* Detailed Answers Toggle */}
            <div className="space-y-4">
              <button
                onClick={() => setShowDetailedAnswers(!showDetailedAnswers)}
                className="w-full flex items-center justify-between p-4 bg-black/50 backdrop-blur-sm rounded-xl border border-[#ffcda2]/30 hover:bg-black/70 transition-all duration-300"
              >
                <h3 className="font-bold text-white text-lg edu-nsw-act-cursive">
                  View Detailed Answers
                </h3>
                <div className="flex items-center space-x-2">
                  <span className="text-[#ffcda2] text-sm">
                    {showDetailedAnswers ? "Hide" : "Show"}
                  </span>
                  <svg
                    className={`w-5 h-5 text-[#ffcda2] transition-transform duration-300 ${
                      showDetailedAnswers ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </button>

              {/* Detailed Answers Content */}
              {showDetailedAnswers && (
                <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
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
                        className={`p-4 rounded-xl border backdrop-blur-sm ${
                          isCorrect
                            ? "border-[#ffcda2]/30 bg-[#ffcda2]/10"
                            : "border-red-400/30 bg-red-500/10"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center">
                            <span
                              className={`text-2xl font-black mr-3 ${
                                isCorrect ? "text-[#ffcda2]" : "text-red-400"
                              }`}
                            >
                              {isCorrect ? "✓" : "✗"}
                            </span>
                            <span className="text-[#ffcda2] font-bold edu-nsw-act-cursive">
                              Question {index + 1}
                            </span>
                          </div>
                          <div
                            className={`px-3 py-1 rounded-full text-sm font-bold ${
                              isCorrect
                                ? "bg-[#ffcda2]/30 text-[#ffcda2] border border-[#ffcda2]/50"
                                : "bg-red-500/30 text-red-300 border border-red-400/50"
                            }`}
                          >
                            {isCorrect ? "Correct" : "Wrong"}
                          </div>
                        </div>

                        <div className="bg-black/30 rounded-lg p-3 mb-3 border border-[#ffcda2]/20">
                          <div className="text-white italic font-medium">
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
                              className="w-10 h-10 rounded-full mr-3 ring-2 ring-[#ffcda2]/50"
                            />
                            <div>
                              <div className="text-white font-bold edu-nsw-act-cursive">
                                You guessed:{" "}
                                {selectedFriend?.user.display_name || "Unknown"}
                              </div>
                              {!isCorrect && (
                                <div className="text-[#ffcda2] text-sm edu-nsw-act-cursive">
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
                                className="w-10 h-10 rounded-full mr-2 ring-2 ring-[#ffcda2]/50"
                              />
                              <span className="text-[#ffcda2] text-sm font-medium">
                                {question.correctFriend.user.display_name}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-4">
              <Button
                onClick={resetGame}
                className="w-full py-5 text-xl font-black bg-[#ffcda2] hover:bg-[#ffcda2]/80 text-black transform hover:scale-105 transition-all duration-300 shadow-lg rounded-xl edu-nsw-act-cursive"
              >
                Play Again
              </Button>

              {context?.user?.fid && (
                <ShareButton
                  buttonText="Share My Results"
                  cast={{
                    text: generateShareText(),
                    embeds: [
                      {
                        path: "/",
                        url: APP_URL || "https://whocast.vercel.app",
                      },
                    ],
                  }}
                  className="w-full py-5 text-xl font-black bg-[#ffcda2] hover:bg-[#ffcda2]/80 text-black transform hover:scale-105 transition-all duration-300 shadow-lg rounded-xl edu-nsw-act-cursive"
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
