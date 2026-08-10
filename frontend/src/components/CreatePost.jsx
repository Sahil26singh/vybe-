import React, { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader } from './ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { readFileAsDataURL } from '@/lib/utils';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import api, { API_URL } from "@/lib/axios";
import { useApp } from '@/context/AppContext';

const CreatePost = ({ open, setOpen }) => {
  const imageRef = useRef();
  const [file, setFile] = useState("");
  const [caption, setCaption] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatingCaption, setGeneratingCaption] = useState(false);
  const { user, posts, setPosts } = useApp();

  const fileChangeHandler = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const dataUrl = await readFileAsDataURL(selectedFile);
      setImagePreview(dataUrl);
    }
  };

  const generateCaptionHandler = async () => {
    if (!file) {
      toast.error("Please select an image first!");
      return;
    }
    const formData = new FormData();
    formData.append("image", file);
    try {
      setGeneratingCaption(true);
      const res = await api.post(`${API_URL}/api/v1/post/generate-caption`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true
      });
      if (res.data?.success && res.data.caption) {
        setCaption(res.data.caption);
        toast.success("AI Caption generated!");
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to generate AI caption");
    } finally {
      setGeneratingCaption(false);
    }
  };

  const createPostHandler = async () => {
    const formData = new FormData();
    formData.append("caption", caption);
    if (imagePreview) formData.append("image", file);
    try {
      setLoading(true);
      const res = await api.post(`${API_URL}/api/v1/post/addpost`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        withCredentials: true
      });
      if (res.data.success) {
        setPosts([res.data.post, ...posts]);
        toast.success(res.data.message);
        setOpen(false);
        setCaption("");
        setImagePreview("");
        setFile("");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Post creation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent onInteractOutside={() => setOpen(false)}>
        <DialogHeader className='text-center font-semibold'>Create New Post</DialogHeader>
        <div className='flex gap-3 items-center'>
          <Avatar>
            <AvatarImage src={user?.profilePicture} alt="img" />
            <AvatarFallback>{(user?.username || "X").slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className='font-semibold text-xs'>{user?.username}</h1>
            <span className='text-gray-600 text-xs'>{user?.bio || "Bio here..."}</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs font-semibold text-gray-500">Caption</span>
          {file && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={generateCaptionHandler}
              disabled={generatingCaption}
              className="text-xs flex items-center gap-1 border-blue-500 text-blue-600 hover:bg-blue-50 h-7 px-2"
            >
              {generatingCaption ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3 text-blue-600" />
                  AI Caption
                </>
              )}
            </Button>
          )}
        </div>

        <Textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="focus-visible:ring-transparent border rounded-md p-2 text-sm"
          placeholder="Write a caption or click AI Caption..."
        />

        {
          imagePreview && (
            <div className='w-full h-64 flex items-center justify-center'>
              <img src={imagePreview} alt="preview_img" className='object-cover h-full w-full rounded-md' />
            </div>
          )
        }
        <input ref={imageRef} type='file' className='hidden' onChange={fileChangeHandler} />
        <Button onClick={() => imageRef.current.click()} className='w-fit mx-auto bg-[#0095F6] hover:bg-[#258bcf] '>Select from computer</Button>
        {
          imagePreview && (
            loading ? (
              <Button disabled>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Please wait
              </Button>
            ) : (
              <Button onClick={createPostHandler} type="submit" className="w-full">Post</Button>
            )
          )
        }
      </DialogContent>
    </Dialog>
  );
};

export default CreatePost;