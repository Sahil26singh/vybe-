import { useApp } from "@/context/AppContext";
import { useEffect } from "react";

const useGetSuggestedUsers = () => {
    const { user, fetchSuggestedUsers } = useApp();

    useEffect(() => {
        if (user?._id) {
            fetchSuggestedUsers();
        }
    }, [user?._id, fetchSuggestedUsers]);
};

export default useGetSuggestedUsers;
