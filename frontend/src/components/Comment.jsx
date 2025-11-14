import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Trash2 } from 'lucide-react';
import { useSelector } from 'react-redux';

const idStr = (v) => (v == null ? '' : String(v));

const Comment = ({ comment, postAuthorId, onDelete }) => {
  const { user } = useSelector((s) => s.auth);

  const canDelete =
    idStr(user?._id) &&
    (idStr(user._id) === idStr(comment?.author?._id) || idStr(user._id) === idStr(postAuthorId) );

  return (
    <div className="my-2">
      <div className="flex gap-3 items-center">
        <Avatar>
          <AvatarImage src={comment?.author?.profilePicture} />
          <AvatarFallback>
            {(comment?.author?.username || 'X').slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <h1 className="font-bold text-sm">
          {comment?.author?.username}{' '}
          <span className="font-normal pl-1">{comment?.text}</span>
        </h1>

        {canDelete && (
          <button
            onClick={() => onDelete?.(comment?._id)}
            className="ml-auto p-1 rounded hover:bg-gray-100"
            title="Delete comment"
            aria-label="Delete comment"
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </button>
        )}
      </div>
    </div>
  );
};

export default Comment;
