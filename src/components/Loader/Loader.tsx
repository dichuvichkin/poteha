import { CircularProgress, StyledComponentProps, withStyles } from '@material-ui/core';
import * as React from 'react';

const styles = () => ({
  wrapper: {
    position: 'fixed' as 'fixed',
    width: '100%',
    height: '100%',
    'z-index': 10,
    background: 'white',

    display: 'flex',
    justifyContent: 'center',
  },
  loader: {
    position: 'relative' as 'relative',
    top: '20vh',
  },
});

function Loader({ isLoading, classes }: { isLoading: boolean } & StyledComponentProps) {
  if (!isLoading) {
    return null;
  }
  return (
    <div className={classes!.wrapper}>
      <CircularProgress className={classes!.loader} disableShrink={true} size={72}/>
    </div>
  );
}

export default withStyles(styles)(Loader);
