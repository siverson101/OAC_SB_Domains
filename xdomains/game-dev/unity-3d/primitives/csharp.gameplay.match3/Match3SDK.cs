// Derived from https://github.com/LibraStack/Match3-SDK (MIT).
// --- Match3.Core ---

// Match3.Core/Interfaces/IGrid.cs
using Match3.Core.Structs;
namespace Match3.Core.Interfaces {
    public interface IGrid {
        int RowCount { get; }
        int ColumnCount { get; }
        bool IsPositionOnGrid(GridPosition gridPosition);
    }
}

// Match3.Core/Interfaces/IGridSlot.cs
namespace Match3.Core.Interfaces {
    public interface IGridSlot {
        int ItemId { get; }
        bool HasItem { get; }
        bool IsMovable { get; }
        bool CanContainItem { get; }
        IGridSlotState State { get; }
        GridPosition GridPosition { get; }
    }
}

// Match3.Core/Interfaces/IGridSlotState.cs
namespace Match3.Core.Interfaces {
    public interface IGridSlotState {
        int GroupId { get; }
        bool IsLocked { get; }
        bool CanContainItem { get; }
    }
}

// Match3.Core/Interfaces/IStatefulSlot.cs
namespace Match3.Core.Interfaces {
    public interface IStatefulSlot {
        bool NextState();
        void ResetState();
    }
}

// Match3.Core/Structs/GridPosition.cs
using System;
using System.Runtime.CompilerServices;
namespace Match3.Core.Structs {
    public readonly struct GridPosition : IEquatable<GridPosition> {
        public GridPosition(int rowIndex, int columnIndex) {
            RowIndex = rowIndex;
            ColumnIndex = columnIndex;
        }
        public int RowIndex { get; }
        public int ColumnIndex { get; }
        public static GridPosition Up { get; } = new GridPosition(-1, 0);
        public static GridPosition Down { get; } = new GridPosition(1, 0);
        public static GridPosition Left { get; } = new GridPosition(0, -1);
        public static GridPosition Right { get; } = new GridPosition(0, 1);
        public static GridPosition Zero { get; } = new GridPosition(0, 0);
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static GridPosition operator +(GridPosition a, GridPosition b) => new GridPosition(a.RowIndex + b.RowIndex, a.ColumnIndex + b.ColumnIndex);
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static GridPosition operator -(GridPosition a, GridPosition b) => new GridPosition(a.RowIndex - b.RowIndex, a.ColumnIndex - b.ColumnIndex);
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static bool operator ==(GridPosition a, GridPosition b) => a.RowIndex == b.RowIndex && a.ColumnIndex == b.ColumnIndex;
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public static bool operator !=(GridPosition a, GridPosition b) => a.RowIndex != b.RowIndex || a.ColumnIndex != b.ColumnIndex;
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public bool Equals(GridPosition other) => RowIndex == other.RowIndex && ColumnIndex == other.ColumnIndex;
        public override bool Equals(object obj) => obj is GridPosition other && Equals(other);
        public override int GetHashCode() => RowIndex.GetHashCode() ^ (ColumnIndex.GetHashCode() << 2);
    }
}

// Match3.Core/GridMath.cs
namespace Match3.Core {
    public static class GridMath {
        public static bool IsPositionOnGrid(Match3.Core.Interfaces.IGrid grid, Match3.Core.Structs.GridPosition gridPosition) => IsPositionOnGrid(gridPosition, grid.RowCount, grid.ColumnCount);
        public static bool IsPositionOnGrid(Match3.Core.Structs.GridPosition gridPosition, int rowCount, int columnCount) =>
            gridPosition.RowIndex >= 0 && gridPosition.RowIndex < rowCount && gridPosition.ColumnIndex >= 0 && gridPosition.ColumnIndex < columnCount;
    }
}

// --- Match3.App ---

// Match3.App/Interfaces/IBoardFillStrategy.cs
using System.Collections.Generic;
namespace Match3.App.Interfaces {
    public interface IBoardFillStrategy<TGridSlot> where TGridSlot : Match3.Core.Interfaces.IGridSlot {
        string Name { get; }
        IEnumerable<IJob> GetFillJobs(IGameBoard<TGridSlot> gameBoard);
        IEnumerable<IJob> GetSolveJobs(IGameBoard<TGridSlot> gameBoard, Match3.App.SolvedData<TGridSlot> solvedData);
    }
}

// Match3.App/Interfaces/IGameBoard.cs
namespace Match3.App.Interfaces {
    public interface IGameBoard<out TGridSlot> : Match3.Core.Interfaces.IGrid where TGridSlot : Match3.Core.Interfaces.IGridSlot {
        TGridSlot this[Match3.Core.Structs.GridPosition gridPosition] { get; }
        TGridSlot this[int rowIndex, int columnIndex] { get; }
        bool IsPositionOnBoard(Match3.Core.Structs.GridPosition gridPosition);
    }
}

// Match3.App/Interfaces/IGameBoardDataProvider.cs
namespace Match3.App.Interfaces {
    public interface IGameBoardDataProvider<out TGridSlot> where TGridSlot : Match3.Core.Interfaces.IGridSlot {
        TGridSlot[,] GetGameBoardSlots(int level);
    }
}

// Match3.App/Interfaces/IGameBoardSolver.cs
namespace Match3.App.Interfaces {
    public interface IGameBoardSolver<TGridSlot> where TGridSlot : Match3.Core.Interfaces.IGridSlot {
        Match3.App.SolvedData<TGridSlot> Solve(IGameBoard<TGridSlot> gameBoard, params Match3.Core.Structs.GridPosition[] gridPositions);
    }
}

// Match3.App/Interfaces/IItemSwapper.cs
using System.Threading;
using Cysharp.Threading.Tasks;
namespace Match3.App.Interfaces {
    public interface IItemSwapper<in TGridSlot> where TGridSlot : Match3.Core.Interfaces.IGridSlot {
        UniTask SwapItemsAsync(TGridSlot gridSlot1, TGridSlot gridSlot2, CancellationToken cancellationToken = default);
    }
}

// Match3.App/Interfaces/IJob.cs
namespace Match3.App.Interfaces {
    public interface IJob {
        int ExecutionOrder { get; }
        UniTask ExecuteAsync(CancellationToken cancellationToken = default);
    }
}

// Match3.App/Interfaces/ILevelGoalsProvider.cs
namespace Match3.App.Interfaces {
    public interface ILevelGoalsProvider<TGridSlot> where TGridSlot : Match3.Core.Interfaces.IGridSlot {
        Match3.App.LevelGoal<TGridSlot>[] GetLevelGoals(int level, IGameBoard<TGridSlot> gameBoard);
    }
}

// Match3.App/Interfaces/ISequenceDetector.cs
namespace Match3.App.Interfaces {
    public interface ISequenceDetector<TGridSlot> where TGridSlot : Match3.Core.Interfaces.IGridSlot {
        Match3.App.ItemSequence<TGridSlot> GetSequence(IGameBoard<TGridSlot> gameBoard, Match3.Core.Structs.GridPosition gridPosition);
    }
}

// Match3.App/Interfaces/ISolvedSequencesConsumer.cs
namespace Match3.App.Interfaces {
    public interface ISolvedSequencesConsumer<TGridSlot> where TGridSlot : Match3.Core.Interfaces.IGridSlot {
        void OnSequencesSolved(Match3.App.SolvedData<TGridSlot> solvedData);
    }
}

// Match3.App/Interfaces/ISpecialItemDetector.cs
namespace Match3.App.Interfaces {
    public interface ISpecialItemDetector<TGridSlot> where TGridSlot : Match3.Core.Interfaces.IGridSlot {
        IEnumerable<TGridSlot> GetSpecialItemGridSlots(IGameBoard<TGridSlot> gameBoard, TGridSlot gridSlot);
    }
}

// Match3.App/GameConfig.cs
namespace Match3.App {
    public class GameConfig<TGridSlot> where TGridSlot : Match3.Core.Interfaces.IGridSlot {
        public Match3.App.Interfaces.IItemSwapper<TGridSlot> ItemSwapper { get; set; }
        public Match3.App.Interfaces.IGameBoardSolver<TGridSlot> GameBoardSolver { get; set; }
        public Match3.App.Interfaces.ILevelGoalsProvider<TGridSlot> LevelGoalsProvider { get; set; }
        public Match3.App.Interfaces.IGameBoardDataProvider<TGridSlot> GameBoardDataProvider { get; set; }
        public Match3.App.Interfaces.ISolvedSequencesConsumer<TGridSlot>[] SolvedSequencesConsumers { get; set; }
    }
}

// Match3.App/ItemSequence.cs
namespace Match3.App {
    public class ItemSequence<TGridSlot> where TGridSlot : Match3.Core.Interfaces.IGridSlot {
        public ItemSequence(System.Type sequenceDetectorType, IReadOnlyList<TGridSlot> solvedGridSlots) {
            SequenceDetectorType = sequenceDetectorType;
            SolvedGridSlots = solvedGridSlots;
        }
        public System.Type SequenceDetectorType { get; }
        public IReadOnlyList<TGridSlot> SolvedGridSlots { get; }
    }
}

// Match3.App/Job.cs
namespace Match3.App {
    public abstract class Job : Match3.App.Interfaces.IJob {
        protected Job(int executionOrder) { ExecutionOrder = executionOrder; }
        public int ExecutionOrder { get; }
        public abstract UniTask ExecuteAsync(CancellationToken cancellationToken = default);
    }
}

// Match3.App/LevelGoal.cs
namespace Match3.App {
    public abstract class LevelGoal<TGridSlot> : Match3.App.Interfaces.ISolvedSequencesConsumer<TGridSlot> where TGridSlot : Match3.Core.Interfaces.IGridSlot {
        public bool IsAchieved { get; private set; }
        public event System.EventHandler Achieved;
        public abstract void OnSequencesSolved(SolvedData<TGridSlot> solvedData);
        protected void MarkAchieved() {
            IsAchieved = true;
            Achieved?.Invoke(this, System.EventArgs.Empty);
        }
    }
}

// Match3.App/SolvedData.cs
namespace Match3.App {
    public class SolvedData<TGridSlot> where TGridSlot : Match3.Core.Interfaces.IGridSlot {
        public SolvedData(IReadOnlyCollection<ItemSequence<TGridSlot>> solvedSequences, IReadOnlyCollection<TGridSlot> specialItemGridSlots) {
            SolvedSequences = solvedSequences; SpecialItemGridSlots = specialItemGridSlots;
        }
        public IReadOnlyCollection<TGridSlot> SpecialItemGridSlots { get; }
        public IReadOnlyCollection<ItemSequence<TGridSlot>> SolvedSequences { get; }
        public IEnumerable<TGridSlot> GetSolvedGridSlots(bool onlyMovable = false) {
            foreach (var sequence in SolvedSequences) {
                foreach (var solvedGridSlot in sequence.SolvedGridSlots) {
                    if (onlyMovable && solvedGridSlot.IsMovable == false) continue;
                    yield return solvedGridSlot;
                }
            }
        }
        public IEnumerable<TGridSlot> GetSpecialItemGridSlots(bool excludeOccupied = false) {
            foreach (var specialItemGridSlot in SpecialItemGridSlots) {
                if (excludeOccupied && specialItemGridSlot.HasItem) continue;
                yield return specialItemGridSlot;
            }
        }
    }
}

// Match3.App/Internal/GameBoard.cs
namespace Match3.App.Internal {
    internal class GameBoard<TGridSlot> : Match3.App.Interfaces.IGameBoard<TGridSlot>, System.IDisposable where TGridSlot : Match3.Core.Interfaces.IGridSlot {
        private int _rowCount;
        private int _columnCount;
        private TGridSlot[,] _gridSlots;
        public int RowCount => _rowCount;
        public int ColumnCount => _columnCount;
        public TGridSlot this[Match3.Core.Structs.GridPosition gridPosition] => _gridSlots[gridPosition.RowIndex, gridPosition.ColumnIndex];
        public TGridSlot this[int rowIndex, int columnIndex] => _gridSlots[rowIndex, columnIndex];
        public void SetGridSlots(TGridSlot[,] gridSlots) {
            if (_gridSlots != null) throw new System.InvalidOperationException("Grid slots have already been created.");
            _rowCount = gridSlots.GetLength(0);
            _columnCount = gridSlots.GetLength(1);
            _gridSlots = gridSlots;
        }
        public bool IsPositionOnGrid(Match3.Core.Structs.GridPosition gridPosition) {
            EnsureGridSlotsIsNotNull();
            return Match3.Core.GridMath.IsPositionOnGrid(this, gridPosition);
        }
        public bool IsPositionOnBoard(Match3.Core.Structs.GridPosition gridPosition) => IsPositionOnGrid(gridPosition) && _gridSlots[gridPosition.RowIndex, gridPosition.ColumnIndex].CanContainItem;
        public void ResetState() { _rowCount = 0; _columnCount = 0; _gridSlots = null; }
        public void Dispose() {
            if (_gridSlots == null) return;
            System.Array.Clear(_gridSlots, 0, _gridSlots.Length);
            ResetState();
        }
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        private void EnsureGridSlotsIsNotNull() {
            if (_gridSlots == null) throw new System.InvalidOperationException("Grid slots are not created.");
        }
    }
}

// Match3.App/Internal/JobsExecutor.cs
using System.Linq;
namespace Match3.App.Internal {
    internal class JobsExecutor {
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        public async UniTask ExecuteJobsAsync(IEnumerable<Match3.App.Interfaces.IJob> jobs, CancellationToken cancellationToken = default) {
            var jobGroups = jobs.GroupBy(job => job.ExecutionOrder).OrderBy(group => group.Key);
            foreach (var jobGroup in jobGroups) {
                await UniTask.WhenAll(jobGroup.Select(job => job.ExecuteAsync(cancellationToken)));
            }
        }
    }
}

// Match3.App/Internal/BaseGame.cs
namespace Match3.App.Internal {
    public abstract class BaseGame<TGridSlot> : System.IDisposable where TGridSlot : Match3.Core.Interfaces.IGridSlot {
        private readonly GameBoard<TGridSlot> _gameBoard;
        private readonly Match3.App.Interfaces.IGameBoardSolver<TGridSlot> _gameBoardSolver;
        private readonly Match3.App.Interfaces.ILevelGoalsProvider<TGridSlot> _levelGoalsProvider;
        private readonly Match3.App.Interfaces.IGameBoardDataProvider<TGridSlot> _gameBoardDataProvider;
        private readonly Match3.App.Interfaces.ISolvedSequencesConsumer<TGridSlot>[] _solvedSequencesConsumers;
        private bool _isStarted;
        private int _achievedGoals;
        private LevelGoal<TGridSlot>[] _levelGoals;
        protected BaseGame(GameConfig<TGridSlot> config) {
            _gameBoard = new GameBoard<TGridSlot>();
            _gameBoardSolver = config.GameBoardSolver;
            _levelGoalsProvider = config.LevelGoalsProvider;
            _gameBoardDataProvider = config.GameBoardDataProvider;
            _solvedSequencesConsumers = config.SolvedSequencesConsumers;
        }
        protected Match3.App.Interfaces.IGameBoard<TGridSlot> GameBoard => _gameBoard;
        public event System.EventHandler Finished;
        public event System.EventHandler<LevelGoal<TGridSlot>> LevelGoalAchieved;
        public void InitGameLevel(int level) {
            if (_isStarted) throw new System.InvalidOperationException("Can not be initialized while the current game is active.");
            _gameBoard.SetGridSlots(_gameBoardDataProvider.GetGameBoardSlots(level));
            _levelGoals = _levelGoalsProvider.GetLevelGoals(level, _gameBoard);
        }
        protected void StartGame() {
            if (_isStarted) throw new System.InvalidOperationException("Game has already been started.");
            foreach (var levelGoal in _levelGoals) levelGoal.Achieved += OnLevelGoalAchieved;
            _isStarted = true;
            OnGameStarted();
        }
        protected void StopGame() {
            if (_isStarted == false) throw new System.InvalidOperationException("Game has not been started.");
            foreach (var levelGoal in _levelGoals) levelGoal.Achieved -= OnLevelGoalAchieved;
            _isStarted = false;
            OnGameStopped();
        }
        public void ResetGameBoard() { _achievedGoals = 0; _gameBoard.ResetState(); }
        public void Dispose() { _gameBoard?.Dispose(); }
        protected abstract void OnGameStarted();
        protected abstract void OnGameStopped();
        protected bool IsSolved(Match3.Core.Structs.GridPosition position1, Match3.Core.Structs.GridPosition position2, out SolvedData<TGridSlot> solvedData) {
            solvedData = _gameBoardSolver.Solve(GameBoard, position1, position2);
            return solvedData.SolvedSequences.Count > 0;
        }
        protected void NotifySequencesSolved(SolvedData<TGridSlot> solvedData) {
            foreach (var sequencesConsumer in _solvedSequencesConsumers) sequencesConsumer.OnSequencesSolved(solvedData);
            foreach (var levelGoal in _levelGoals) if (levelGoal.IsAchieved == false) levelGoal.OnSequencesSolved(solvedData);
        }
        protected virtual void OnAllGoalsAchieved() { Finished?.Invoke(this, System.EventArgs.Empty); }
        private void OnLevelGoalAchieved(object sender, System.EventArgs e) {
            LevelGoalAchieved?.Invoke(this, (LevelGoal<TGridSlot>) sender);
            _achievedGoals++;
            if (_achievedGoals == _levelGoals.Length) OnAllGoalsAchieved();
        }
    }
}

// Match3.App/Match3Game.cs
namespace Match3.App {
    public abstract class Match3Game<TGridSlot> : Match3.App.Internal.BaseGame<TGridSlot> where TGridSlot : Match3.Core.Interfaces.IGridSlot {
        private readonly Match3.App.Internal.JobsExecutor _jobsExecutor;
        private readonly Match3.App.Interfaces.IItemSwapper<TGridSlot> _itemSwapper;
        private AsyncLazy _swapItemsTask;
        private Match3.App.Interfaces.IBoardFillStrategy<TGridSlot> _fillStrategy;
        protected Match3Game(GameConfig<TGridSlot> config) : base(config) {
            _itemSwapper = config.ItemSwapper;
            _jobsExecutor = new Match3.App.Internal.JobsExecutor();
        }
        protected bool IsSwapItemsCompleted {
            [MethodImpl(MethodImplOptions.AggressiveInlining)]
            get => _swapItemsTask == null || _swapItemsTask.Task.Status.IsCompleted();
        }
        public async UniTask StartAsync(CancellationToken cancellationToken = default) {
            if (_fillStrategy == null) throw new System.NullReferenceException(nameof(_fillStrategy));
            await FillAsync(_fillStrategy, cancellationToken);
            StartGame();
        }
        public async UniTask StopAsync() {
            if (IsSwapItemsCompleted == false) await _swapItemsTask;
            StopGame();
        }
        public void SetGameBoardFillStrategy(Match3.App.Interfaces.IBoardFillStrategy<TGridSlot> fillStrategy) { _fillStrategy = fillStrategy; }
        protected override void OnAllGoalsAchieved() { RaiseGameFinishedAsync().Forget(); }
        protected UniTask SwapItemsAsync(Match3.Core.Structs.GridPosition position1, Match3.Core.Structs.GridPosition position2, CancellationToken cancellationToken = default) {
            if (_swapItemsTask?.Task.Status.IsCompleted() ?? true) {
                _swapItemsTask = SwapItemsAsync(_fillStrategy, position1, position2, cancellationToken).ToAsyncLazy();
            }
            return _swapItemsTask.Task;
        }
        private async UniTask FillAsync(Match3.App.Interfaces.IBoardFillStrategy<TGridSlot> fillStrategy, CancellationToken cancellationToken = default) {
            await ExecuteJobsAsync(fillStrategy.GetFillJobs(GameBoard), cancellationToken);
        }
        protected virtual async UniTask SwapItemsAsync(Match3.App.Interfaces.IBoardFillStrategy<TGridSlot> fillStrategy, Match3.Core.Structs.GridPosition position1, Match3.Core.Structs.GridPosition position2, CancellationToken cancellationToken = default) {
            await SwapGameBoardItemsAsync(position1, position2, cancellationToken);
            if (IsSolved(position1, position2, out var solvedData)) {
                NotifySequencesSolved(solvedData);
                await ExecuteJobsAsync(fillStrategy.GetSolveJobs(GameBoard, solvedData), cancellationToken);
            } else {
                await SwapGameBoardItemsAsync(position1, position2, cancellationToken);
            }
        }
        protected async UniTask SwapGameBoardItemsAsync(Match3.Core.Structs.GridPosition position1, Match3.Core.Structs.GridPosition position2, CancellationToken cancellationToken = default) {
            var gridSlot1 = GameBoard[position1.RowIndex, position1.ColumnIndex];
            var gridSlot2 = GameBoard[position2.RowIndex, position2.ColumnIndex];
            await _itemSwapper.SwapItemsAsync(gridSlot1, gridSlot2, cancellationToken);
        }
        protected UniTask ExecuteJobsAsync(IEnumerable<Match3.App.Interfaces.IJob> jobs, CancellationToken cancellationToken = default) {
            return _jobsExecutor.ExecuteJobsAsync(jobs, cancellationToken);
        }
        private async UniTask RaiseGameFinishedAsync() {
            if (IsSwapItemsCompleted == false) await _swapItemsTask;
            base.OnAllGoalsAchieved();
        }
    }
}

// --- Match3.Infrastructure ---

// Match3.Infrastructure/Interfaces/IDeactivatable.cs
namespace Match3.Infrastructure.Interfaces {
    public interface IDeactivatable { void Deactivate(); }
}

// Match3.Infrastructure/Interfaces/IGameBoardRenderer.cs
namespace Match3.Infrastructure.Interfaces {
    public interface IGameBoardRenderer : System.IDisposable {
        void CreateGridTiles(int[,] data);
        void ResetGridTiles();
    }
}

// Match3.Infrastructure/Interfaces/IGameMode.cs
namespace Match3.Infrastructure.Interfaces {
    public interface IGameMode {
        event System.EventHandler Finished;
        void Activate();
    }
}

// Match3.Infrastructure/Interfaces/IItemGenerator.cs
namespace Match3.Infrastructure.Interfaces {
    public interface IItemGenerator : System.IDisposable {
        void CreateItems(int capacity);
    }
}

// Match3.Infrastructure/Interfaces/IItemsPool.cs
namespace Match3.Infrastructure.Interfaces {
    public interface IItemsPool<TItem> {
        TItem GetItem();
        void ReturnItem(TItem item);
    }
}

// Match3.Infrastructure/Extensions/AppModeExtensions.cs
namespace Match3.Infrastructure.Extensions {
    public static class AppModeExtensions {
        public static void Deactivate(this Match3.Infrastructure.Interfaces.IGameMode gameMode) {
            if (gameMode is Match3.Infrastructure.Interfaces.IDeactivatable deactivatable) deactivatable.Deactivate();
        }
        public static void Dispose(this Match3.Infrastructure.Interfaces.IGameMode gameMode) {
            if (gameMode is System.IDisposable disposable) disposable.Dispose();
        }
    }
}

// Match3.Infrastructure/Extensions/ItemsSequenceExtensions.cs
namespace Match3.Infrastructure.Extensions {
    public static class ItemsSequenceExtensions {
        public static IEnumerable<TGridSlot> GetUniqueSolvedGridSlots<TGridSlot>(this Match3.App.SolvedData<TGridSlot> solvedData, bool onlyMovable = false) where TGridSlot : Match3.Core.Interfaces.IGridSlot {
            var solvedGridSlots = new HashSet<TGridSlot>();
            foreach (var solvedGridSlot in solvedData.GetSolvedGridSlots(onlyMovable)) {
                if (solvedGridSlots.Add(solvedGridSlot) == false) continue;
                yield return solvedGridSlot;
            }
            solvedGridSlots.Clear();
        }
    }
}

// Match3.Infrastructure/GameBoardSolver.cs
namespace Match3.Infrastructure {
    public class GameBoardSolver<TGridSlot> : Match3.App.Interfaces.IGameBoardSolver<TGridSlot> where TGridSlot : Match3.Core.Interfaces.IGridSlot {
        private readonly Match3.App.Interfaces.ISpecialItemDetector<TGridSlot>[] _specialItemDetectors;
        private readonly Match3.App.Interfaces.ISequenceDetector<TGridSlot>[] _sequenceDetectors;
        public GameBoardSolver(Match3.App.Interfaces.ISequenceDetector<TGridSlot>[] sequenceDetectors, Match3.App.Interfaces.ISpecialItemDetector<TGridSlot>[] specialItemDetectors) {
            _sequenceDetectors = sequenceDetectors;
            _specialItemDetectors = specialItemDetectors;
        }
        public Match3.App.SolvedData<TGridSlot> Solve(Match3.App.Interfaces.IGameBoard<TGridSlot> gameBoard, params Match3.Core.Structs.GridPosition[] gridPositions) {
            var resultSequences = new System.Collections.ObjectModel.Collection<Match3.App.ItemSequence<TGridSlot>>();
            var specialItemGridSlots = new HashSet<TGridSlot>();
            foreach (var gridPosition in gridPositions) {
                foreach (var sequenceDetector in _sequenceDetectors) {
                    var sequence = sequenceDetector.GetSequence(gameBoard, gridPosition);
                    if (sequence == null) continue;
                    if (IsNewSequence(sequence, resultSequences) == false) continue;
                    foreach (var specialItemGridSlot in GetSpecialItemGridSlots(gameBoard, sequence)) specialItemGridSlots.Add(specialItemGridSlot);
                    resultSequences.Add(sequence);
                }
            }
            return new Match3.App.SolvedData<TGridSlot>(resultSequences, specialItemGridSlots);
        }
        private bool IsNewSequence(Match3.App.ItemSequence<TGridSlot> newSequence, IEnumerable<Match3.App.ItemSequence<TGridSlot>> sequences) {
            var sequencesByType = sequences.Where(sequence => sequence.SequenceDetectorType == newSequence.SequenceDetectorType);
            var newSequenceGridSlot = newSequence.SolvedGridSlots[0];
            return sequencesByType.All(sequence => sequence.SolvedGridSlots.Contains(newSequenceGridSlot) == false);
        }
        [MethodImpl(MethodImplOptions.AggressiveInlining)]
        private IEnumerable<TGridSlot> GetSpecialItemGridSlots(Match3.App.Interfaces.IGameBoard<TGridSlot> gameBoard, Match3.App.ItemSequence<TGridSlot> sequence) {
            foreach (var itemDetector in _specialItemDetectors) {
                foreach (var solvedGridSlot in sequence.SolvedGridSlots) {
                    foreach (var specialItemGridSlot in itemDetector.GetSpecialItemGridSlots(gameBoard, solvedGridSlot)) {
                        var hasNextState = ((Match3.Core.Interfaces.IStatefulSlot) specialItemGridSlot.State).NextState();
                        if (hasNextState) continue;
                        yield return specialItemGridSlot;
                    }
                }
            }
        }
    }
}

// Match3.Infrastructure/ItemGenerator.cs
namespace Match3.Infrastructure {
    public abstract class ItemGenerator<TItem> : Match3.Infrastructure.Interfaces.IItemGenerator, Match3.Infrastructure.Interfaces.IItemsPool<TItem> {
        private Queue<TItem> _itemsPool;
        public void CreateItems(int capacity) {
            if (_itemsPool != null) throw new System.InvalidOperationException("Items have already been created.");
            _itemsPool = new Queue<TItem>(capacity);
            for (var i = 0; i < capacity; i++) _itemsPool.Enqueue(CreateItem());
        }
        public TItem GetItem() => ConfigureItem(_itemsPool.Dequeue());
        public void ReturnItem(TItem item) { _itemsPool.Enqueue(item); }
        public virtual void Dispose() {
            if (_itemsPool == null) return;
            foreach (var item in _itemsPool) {
                if (item is System.IDisposable disposable) disposable.Dispose();
                else break;
            }
            _itemsPool.Clear(); _itemsPool = null;
        }
        protected abstract TItem CreateItem();
        protected abstract TItem ConfigureItem(TItem item);
    }
}

// Match3.Infrastructure/SequenceDetectors/LineDetector.cs
namespace Match3.Infrastructure.SequenceDetectors {
    public abstract class LineDetector<TGridSlot> : Match3.App.Interfaces.ISequenceDetector<TGridSlot> where TGridSlot : Match3.Core.Interfaces.IGridSlot {
        public abstract Match3.App.ItemSequence<TGridSlot> GetSequence(Match3.App.Interfaces.IGameBoard<TGridSlot> gameBoard, Match3.Core.Structs.GridPosition gridPosition);
        protected Match3.App.ItemSequence<TGridSlot> GetSequenceByDirection(Match3.App.Interfaces.IGameBoard<TGridSlot> gameBoard, Match3.Core.Structs.GridPosition gridPosition, IEnumerable<Match3.Core.Structs.GridPosition> directions) {
            var gridSlot = gameBoard[gridPosition];
            var gridSlots = new List<TGridSlot>();
            foreach (var direction in directions) gridSlots.AddRange(GetSequenceOfGridSlots(gameBoard, gridSlot, gridPosition, direction));
            if (gridSlots.Count < 2) return null;
            gridSlots.Add(gridSlot);
            return new Match3.App.ItemSequence<TGridSlot>(GetType(), gridSlots);
        }
        private IEnumerable<TGridSlot> GetSequenceOfGridSlots(Match3.App.Interfaces.IGameBoard<TGridSlot> gameBoard, TGridSlot gridSlot, Match3.Core.Structs.GridPosition gridPosition, Match3.Core.Structs.GridPosition direction) {
            var newPosition = gridPosition + direction;
            var slotsSequence = new List<TGridSlot>();
            while (gameBoard.IsPositionOnBoard(newPosition)) {
                var currentSlot = gameBoard[newPosition];
                if (currentSlot.HasItem == false) break;
                if (currentSlot.ItemId == gridSlot.ItemId) {
                    newPosition += direction;
                    slotsSequence.Add(currentSlot);
                } else break;
            }
            return slotsSequence;
        }
    }
}

// Match3.Infrastructure/SequenceDetectors/HorizontalLineDetector.cs
namespace Match3.Infrastructure.SequenceDetectors {
    public class HorizontalLineDetector<TGridSlot> : LineDetector<TGridSlot> where TGridSlot : Match3.Core.Interfaces.IGridSlot {
        private readonly Match3.Core.Structs.GridPosition[] _lineDirections;
        public HorizontalLineDetector() { _lineDirections = new[] { Match3.Core.Structs.GridPosition.Left, Match3.Core.Structs.GridPosition.Right }; }
        public override Match3.App.ItemSequence<TGridSlot> GetSequence(Match3.App.Interfaces.IGameBoard<TGridSlot> gameBoard, Match3.Core.Structs.GridPosition gridPosition) {
            return GetSequenceByDirection(gameBoard, gridPosition, _lineDirections);
        }
    }
}

// Match3.Infrastructure/SequenceDetectors/VerticalLineDetector.cs
namespace Match3.Infrastructure.SequenceDetectors {
    public class VerticalLineDetector<TGridSlot> : LineDetector<TGridSlot> where TGridSlot : Match3.Core.Interfaces.IGridSlot {
        private readonly Match3.Core.Structs.GridPosition[] _lineDirections;
        public VerticalLineDetector() { _lineDirections = new[] { Match3.Core.Structs.GridPosition.Up, Match3.Core.Structs.GridPosition.Down }; }
        public override Match3.App.ItemSequence<TGridSlot> GetSequence(Match3.App.Interfaces.IGameBoard<TGridSlot> gameBoard, Match3.Core.Structs.GridPosition gridPosition) {
            return GetSequenceByDirection(gameBoard, gridPosition, _lineDirections);
        }
    }
}
