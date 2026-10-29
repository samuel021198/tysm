/** Keeps the fullscreen thread shell up while the conversation loads. */
export default function ThreadLoading() {
  return (
    <div className="thread-fit" role="status">
      <div className="spinner m-auto" />
    </div>
  );
}
