"use client";

import { useCallback, useEffect, useState } from "react";
import { useMiniApp } from "@neynar/react";
import { Button } from "~/components/ui/Button";
import { ShareButton } from "~/components/ui/Share";

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

    const friendNames = gameState.selectedFriends
      .map((friend) => friend.user.display_name)
      .join(", ");

    const percentage = Math.round(
      (gameState.score / gameState.questions.length) * 100
    );

    let performanceEmoji = "🎯";
    if (percentage === 100) performanceEmoji = "🏆";
    else if (percentage >= 80) performanceEmoji = "🎉";
    else if (percentage >= 60) performanceEmoji = "👍";
    else performanceEmoji = "🤔";

    return `🎭 WhoCast Results: ${gameState.score}/${gameState.questions.length} (${percentage}%) ${performanceEmoji}

👥 Friends tested: ${friendNames}

🎮 Play WhoCast and see how well you know your friends! Can you beat my score?`;
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
    <div className="mx-auto py-2 px-4 pb-20">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-4">
          <img
            src="/whocastlogo.png"
            alt="WhoCast"
            className="h-16 mx-auto mb-2"
          />
        </div>
        <p className="text-center text-muted-foreground mb-6">
          Guess which friend wrote each cast!
        </p>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4 text-destructive text-center">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-purple-600 border-t-transparent rounded-full" />
          </div>
        )}

        {/* Friend Selection Screen */}
        {!gameState.gameStarted && !loading && (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Select 5-8 Friends</h2>
              <p className="text-sm text-muted-foreground">
                Choose friends to create your 10-question quiz
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto">
              {following.map((friend) => {
                const isSelected = gameState.selectedFriends.some(
                  (f) => f.user.fid === friend.user.fid
                );

                return (
                  <button
                    key={friend.user.fid}
                    onClick={() => toggleFriend(friend)}
                    disabled={
                      !isSelected && gameState.selectedFriends.length >= 8
                    }
                    className={`flex items-center p-3 rounded-lg border transition-all ${
                      isSelected
                        ? "bg-purple-100 border-purple-300 dark:bg-purple-900/20 dark:border-purple-700"
                        : "bg-card border-border hover:bg-accent"
                    } ${
                      !isSelected && gameState.selectedFriends.length >= 8
                        ? "opacity-50"
                        : ""
                    }`}
                  >
                    <img
                      src={friend.user.pfp_url}
                      alt={friend.user.display_name}
                      className="w-10 h-10 rounded-full mr-3"
                    />
                    <div className="text-left">
                      <div className="font-medium">
                        {friend.user.display_name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        @{friend.user.username}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="ml-auto text-purple-600">✓</div>
                    )}
                  </button>
                );
              })}
            </div>

            <Button
              onClick={() => generateQuiz(gameState.selectedFriends)}
              disabled={gameState.selectedFriends.length < 5}
              className="mt-6"
            >
              Start Quiz ({gameState.selectedFriends.length}/5+)
            </Button>
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
                  className="h-12 mx-auto mb-3"
                />
                <div className="text-sm text-muted-foreground mb-2">
                  Question {gameState.currentQuestionIndex + 1} of{" "}
                  {gameState.questions.length}
                </div>
                <div className="text-lg font-semibold">
                  Score: {gameState.score}
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-lg leading-relaxed">
                  &ldquo;{currentQuestion.cast.text}&rdquo;
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-center font-medium">
                  Who wrote this cast?
                </h3>
                {currentQuestion.options.map((friend) => (
                  <button
                    key={friend.user.fid}
                    onClick={() => selectAnswer(friend)}
                    className="flex items-center w-full p-3 rounded-lg border border-border hover:bg-accent transition-colors"
                  >
                    <img
                      src={friend.user.pfp_url}
                      alt={friend.user.display_name}
                      className="w-12 h-12 rounded-full mr-3"
                    />
                    <div className="text-left">
                      <div className="font-medium">
                        {friend.user.display_name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        @{friend.user.username}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

        {/* Results Screen */}
        {gameState.gameFinished && !loading && (
          <div className="space-y-6">
            <div className="text-center">
              <img
                src="/whocastlogo.png"
                alt="WhoCast"
                className="h-12 mx-auto mb-3"
              />
              <h2 className="text-2xl font-bold mb-2">Quiz Complete!</h2>
              <div className="text-4xl font-bold text-purple-600 mb-2">
                {gameState.score}/{gameState.questions.length}
              </div>
              <p className="text-muted-foreground">
                {gameState.score === gameState.questions.length
                  ? "Perfect score! 🎉"
                  : gameState.score >= gameState.questions.length * 0.8
                  ? "Great job! 🎉"
                  : gameState.score >= gameState.questions.length * 0.6
                  ? "Not bad! 🎉"
                  : "Better luck next time! 🎉"}
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold">Your Answers:</h3>
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
                    className={`p-3 rounded-lg border ${
                      isCorrect
                        ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700"
                        : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700"
                    }`}
                  >
                    <div className="text-sm text-muted-foreground mb-1">
                      Question {index + 1}
                    </div>
                    <div className="text-sm mb-2">
                      &ldquo;{question.cast.text}&rdquo;
                    </div>
                    <div className="flex items-center text-sm">
                      <span
                        className={
                          isCorrect ? "text-green-600" : "text-red-600"
                        }
                      >
                        {isCorrect ? "✓" : "✗"}
                      </span>
                      <span className="ml-2">
                        You guessed:{" "}
                        {selectedFriend?.user.display_name || "Unknown"}
                      </span>
                    </div>
                    {!isCorrect && (
                      <div className="text-sm text-muted-foreground mt-1">
                        Correct: {question.correctFriend.user.display_name}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="space-y-3">
              <Button onClick={resetGame} className="w-full">
                Play Again
              </Button>

              {context?.user?.fid && (
                <ShareButton
                  buttonText="Share My WhoCast Results"
                  cast={{
                    text: generateShareText(),
                    embeds: [
                      `${process.env.NEXT_PUBLIC_URL}/share/${context.user.fid}`,
                    ],
                  }}
                  className="w-full"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
