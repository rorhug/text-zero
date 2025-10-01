const Shortcut = ({ keys, text }: { keys: string; text: string }) => (
  <span className="inline-block px-1 py-0.5 text-xs text-muted-foreground bg-muted rounded">
    <span className="mr-0.5 font-medium text-foreground">
      {keys.toUpperCase()}
    </span>
    {text}
  </span>
);

export default Shortcut;
