import {
  Button,
  StyledComponentProps,
  withStyles,
} from '@material-ui/core';
import { green } from '@material-ui/core/colors';
import { Slider } from '@material-ui/lab';
import debounce from 'lodash/debounce';
import * as React from 'react';
import { getTaskData, IFrame } from '../../api/task.api';
import Loader from '../Loader';

interface IState {
  isLoading: boolean;
  title: string;
  frames: IFrame[];
  selected: Set<number>;
  donePages: number;
  leftPages: number;
  frameWidth: number;
  sliderValue: number;
  firstSelectId?: number;
  lastSelectId?: number;
}

const INITIAL_WIDTH = 300;
const INITIAL_HEIGHT = 300 * (9 / 16);
const MIN_WIDTH = 100;

const styles = () => ({
  root: {
    display: 'flex',
    'flex-direction': 'column',
    'align-items': 'center',
  },
  gridList: {
    display: 'flex',
    'flex-wrap': 'wrap',
    'justify-content': 'center',
  },
  navBar: {
    display: 'flex',
    'align-items': 'baseline',
    'justify-content': 'space-around',
    width: '100%',
    margin: '2rem 0',
  },
  actions: {
    display: 'flex',
    'align-items': 'baseline',
    'justify-content': 'space-between',
    width: '500px',
  },
  listTile: {
    padding: '2px',
    '&.marked': {
      transform: 'scale(0.9)',
    },
    '&:hover:not(.marked)': {
      background: 'orange',
      cursor: 'pointer',
    },
  },
  image: {
    width: '100%',
    height: '100%',
  },
  slider: {
    width: '300px',
  },
  successButton: {
    color: 'white',
    backgroundColor: green[500],
    '&:hover': {
      backgroundColor: green[700],
    },
  },
});

class Frames extends React.PureComponent<StyledComponentProps, IState> {
  state: IState = {
    isLoading: true,
    title: '',
    frames: [],
    selected: new Set(),
    donePages: 0,
    leftPages: 0,
    frameWidth: INITIAL_WIDTH,
    sliderValue: 0,
  };

  private get isDone() {
    const { donePages, leftPages } = this.state;
    return leftPages - donePages === 1;
  }

  private get maxWidth() {
    if (this.frameGridRef.current) {
      return (window.innerWidth * (
        window.innerHeight - (this.frameGridRef.current.getBoundingClientRect().top + 30))
      ) / window.innerHeight;
    }
    return INITIAL_WIDTH;
  }

  private imageFrameRefs: Array<React.RefObject<any>> = [];
  private frameGridRef = React.createRef<HTMLDivElement>();

  private newWindowReference: Window | null = null;

  private setFrameWidth = debounce(
    (value: number) => {
      this.setIsLoading(true);
      let frameWidth = (value * window.innerWidth) / 100;
      if (frameWidth < MIN_WIDTH) {
        frameWidth = MIN_WIDTH;
      }
      if (frameWidth > this.maxWidth) {
        frameWidth = this.maxWidth;
      }
      this.setState({ frameWidth, donePages: 0 }, async () => {
        await this.fetchData();
        this.setIsLoading(false);
      });
    },
    300,
  );

  private onWindowResize = debounce(
    async () => {
      this.setIsLoading(true);
      this.setState({ donePages: 0 }, async () => {
        await this.fetchData();
        this.setIsLoading(false);
      });
    },
    500,
  );

  async componentDidMount() {
    window.addEventListener('resize', this.onWindowResize);
    this.setSliderValue();
    await this.fetchData();
    this.setIsLoading(false);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.onWindowResize);
  }

  render() {
    const { classes } = this.props;
    const {
      title,
      frames,
      frameWidth,
      leftPages,
      donePages,
      isLoading,
      sliderValue,
    } = this.state;
    const minHeight = frameWidth === INITIAL_WIDTH ? INITIAL_HEIGHT : 'auto';
    return (
      <div className={classes!.root}>
        <Loader isLoading={isLoading}/>
        <h1>{title}</h1>
        <div className={classes!.navBar}>
          <Slider
            value={sliderValue}
            onChange={this.handleSliderChange}
            className={classes!.slider}
          />
          <div>{donePages} done / {leftPages - donePages} left</div>
          <div className={classes!.actions}>
            <Button
              onClick={this.openPreview}
              variant="contained"
              color="primary"
            >
              Preview
            </Button>
            <Button
              onClick={this.selectAll}
              variant="contained"
              color="primary"
            >
              Select all
            </Button>
            <Button
              onClick={this.deselectAll}
              variant="contained"
              color="primary"
            >
              Deselect all
            </Button>
            <Button
              onClick={this.onNextButtonClick}
              variant="contained"
              color="primary"
              className={this.isDone ? classes!.successButton : ''}
            >
              {this.isDone ? 'Save' : 'Next'}
            </Button>
          </div>
        </div>
        <div ref={this.frameGridRef} className={classes!.gridList}>
          {frames.map((frame, index) => (
            <div
              ref={this.imageFrameRefs[index]}
              onClick={evt => this.onFrameClick(evt, frame.id)}
              onContextMenu={evt => this.onFrameClick(evt, frame.id)}
              className={`${classes!.listTile} ${frame.marked ? 'marked' : ''}`}
              style={{ width: `${frameWidth}px`, minHeight }}
              key={`photo-id-${frame.id}`}
              onMouseEnter={() => this.onFrameHover(frame.id)}
            >
              <img src={frame.url} alt={`photo-${frame.id}`} className={classes!.image}/>
            </div>
          ))}
        </div>
      </div>
    );
  }

  private onFrameHover = (id: number) => {
    if (this.newWindowReference) {
      if (this.newWindowReference.closed) {
        this.newWindowReference = null;
        return;
      }
      const { frames } = this.state;
      const frame = frames.find(f => f.id === id);
      this.newWindowReference.location.replace(frame!.url);
    }
  }

  private openPreview = () => {
    const { frames } = this.state;
    this.newWindowReference = window.open(frames[0].url, '_blank', 'width=1000,height=800');
  }

  private selectAll = () => {
    const { frames } = this.state;
    const selectedFrames = frames.map(frame => ({ ...frame, marked: true }));
    this.addSelectedRange(selectedFrames.map(frame => frame.id));
    this.setState({ frames: selectedFrames });
  }

  private deselectAll = () => {
    const { frames } = this.state;
    const selectedFrames = frames.map(frame => ({ ...frame, marked: false }));
    this.removeSelectedRange(selectedFrames.map(frame => frame.id));
    this.setState({ frames: selectedFrames });
  }

  private setSliderValue() {
    const { frameWidth } = this.state;
    this.setState({
      sliderValue: (frameWidth * 100) / window.innerWidth - (MIN_WIDTH * 100) / window.innerWidth,
    });
  }

  private handleSliderChange = (evt: React.ChangeEvent<{}>, value: number) => {
    this.setState({ sliderValue: value }, () => this.setFrameWidth(value));
  }

  private onFrameClick(evt: React.MouseEvent, id: number) {
    if (evt.type === 'contextmenu') {
      if (evt.currentTarget.classList.contains('marked')) {
        evt.preventDefault();
        this.deselectRange(id);
      }
      return;
    }

    this.setState(
      (state) => {
        if (!state.firstSelectId) {
          return { firstSelectId: id };
        }
        if (!state.lastSelectId) {
          return { lastSelectId: id };
        }
        return null;
      },
      this.selectRange,
    );
  }

  private deselectRange(id: number) {
    const { frames } = this.state;
    const initialIndex = frames.findIndex(frame => frame.id === id);

    const finishFrame = frames.slice(initialIndex).find(frame => !frame.marked);
    let finishIndex = frames.length - 1;
    if (finishFrame) {
      finishIndex = frames.findIndex(frame => frame.id === finishFrame.id)! - 1;
    }

    const framesToReverse = [...frames];
    const startFrame = framesToReverse
      .reverse().slice(frames.length - initialIndex - 1).find(frame => !frame.marked);
    let startIndex = 0;
    if (startFrame) {
      startIndex = framesToReverse.reverse().findIndex(frame => frame.id === startFrame.id)! + 1;
    }

    this.markRangeByStartFinishIndex(startIndex, finishIndex, false);
  }

  private onNextButtonClick = () => {
    const { donePages, selected } = this.state;
    if (!this.isDone) {
      this.setIsLoading(true);
      this.setState({ donePages: donePages + 1 }, async () => {
        await this.fetchData();
        this.setIsLoading(false);
      });
    } else {
      console.log('selected', Array.from(selected));
    }
  }

  private setIsLoading(isLoading: boolean) {
    this.setState({ isLoading });
  }

  private getFramesWithMarkedByIndex(index: number, marked: boolean) {
    const { frames } = this.state;
    const newFrames = [...frames];
    newFrames[index] = {
      ...frames[index],
      marked,
    };
    return newFrames;
  }

  private selectRange = () => {
    const { firstSelectId, lastSelectId, frames } = this.state;
    if (!firstSelectId) {
      return;
    }

    const firstSelectFrameIndex = frames.findIndex(
      frame => frame.id === firstSelectId,
    );

    if (!lastSelectId) {
      this.setState({
        frames: this.getFramesWithMarkedByIndex(firstSelectFrameIndex, true),
      });
      this.addSelectedRange([frames[firstSelectFrameIndex].id]);
      return;
    }

    const lastSelectFrameIndex = frames.findIndex(
      frame => frame.id === lastSelectId,
    );

    if (firstSelectFrameIndex > lastSelectFrameIndex) {
      this.setState({
        frames: this.getFramesWithMarkedByIndex(firstSelectFrameIndex, false),
        firstSelectId: undefined,
        lastSelectId: undefined,
      });
      this.removeSelectedRange([frames[firstSelectFrameIndex].id]);
      return;
    }

    this.markRangeByStartFinishIndex(firstSelectFrameIndex, lastSelectFrameIndex);
    this.setState({
      firstSelectId: undefined,
      lastSelectId: undefined,
    });
  }

  private markRangeByStartFinishIndex(startIndex: number, finishIndex: number, marked = true) {
    const { frames } = this.state;
    const markedFrames = frames.map((frame, index) => {
      if (index >= startIndex && index <= finishIndex) {
        return {
          ...frame,
          marked,
        };
      }
      return frame;
    });
    this.setState({
      frames: markedFrames,
    });
    if (marked) {
      const ids = markedFrames.filter(frame => frame.marked).map(frame => frame.id);
      this.addSelectedRange(ids);
    } else {
      const ids = markedFrames.filter(frame => !frame.marked).map(frame => frame.id);
      this.removeSelectedRange(ids);
    }
  }

  private async fetchData() {
    const { task_title, frames } = await getTaskData();
    this.imageFrameRefs = frames.map(() => React.createRef());
    this.setState(
      {
        title: task_title,
        frames,
      },
      this.recomposeFrames,
    );
    this.addSelectedRange(
      frames
        .filter(frame => frame.marked)
        .map(frame => frame.id),
    );
  }

  private addSelectedRange(ids: number[]) {
    this.setState((state) => {
      ids.forEach((id) => {
        state.selected.add(id);
      });
      return { selected: state.selected };
    });
  }

  private removeSelectedRange(ids: number[]) {
    this.setState((state) => {
      ids.forEach((id) => {
        state.selected.delete(id);
      });
      return { selected: state.selected };
    });
  }

  private recomposeFrames = () => {
    const { frames, donePages } = this.state;
    this.setState(() => {
      const notFullyIntersectedFrameIndex = this.imageFrameRefs.findIndex((frame) => {
        const { bottom } = frame.current!.getBoundingClientRect();
        return bottom > window.innerHeight - 20;
      });
      if (notFullyIntersectedFrameIndex === -1) {
        return null;
      }
      this.imageFrameRefs = [];
      const slicedFrames = frames
        .slice(donePages * notFullyIntersectedFrameIndex)
        .slice(0, notFullyIntersectedFrameIndex);
      return {
        frames: slicedFrames,
        leftPages: Math.ceil(frames.length / notFullyIntersectedFrameIndex),
      };
    });
  }
}

export default withStyles(styles)(Frames);
