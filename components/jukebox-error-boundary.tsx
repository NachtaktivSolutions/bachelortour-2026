"use client";

import React from "react";

type Props={children:React.ReactNode};
type State={failed:boolean};

export class JukeboxErrorBoundary extends React.Component<Props,State>{
  state:State={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(error:unknown){console.error("Jukebox crashed and was isolated:",error);}
  render(){return this.state.failed?null:this.props.children;}
}
