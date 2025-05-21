declare module "d3" {
  export * from "d3-selection";
  export * from "d3-scale";
  export * from "d3-scale-chromatic";
  export * from "d3-axis";
  export * from "d3-array";

  // Add custom type overrides if needed
  interface Selection {
    attr(name: string, value: any): Selection;
  }
}
