import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  CheckCircle, 
  Clock, 
  Upload, 
  MessageSquare, 
  Send, 
  ShieldCheck, 
  FileText, 
  Sparkles,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface PbcItem {
  id: number;
  engagementId: number;
  category: string;
  itemName: string;
  description: string | null;
  dueDate: string | null;
  receivedAt: string | null;
  fileName: string | null;
  status: "requested" | "received" | "reviewed";
}

interface ThreadMessage {
  id: number;
  role: string;
  content: string;
  authorType: "auditor" | "client" | "system";
  authorName: string | null;
  createdAt: string;
}

export default function ClientPortalPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string>("");
  const [engagementId, setEngagementId] = useState<number>(1);
  const [clientEmail, setClientEmail] = useState<string>("cfo@client.com");
  const [authenticated, setAuthenticated] = useState<boolean>(false);
  const [activeItem, setActiveItem] = useState<PbcItem | null>(null);
  const [chatMessage, setChatMessage] = useState<string>("");

  // Check URL params for magic link on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    const urlEng = params.get("engagement");
    if (urlToken) {
      setToken(urlToken);
      if (urlEng) setEngagementId(Number(urlEng));
      verifyToken(urlToken);
    } else {
      // Check session
      checkSession();
    }
  }, []);

  const verifyToken = async (rawToken: string) => {
    try {
      const res = await fetch(`/api/portal/verify?token=${rawToken}`);
      if (res.ok) {
        const data = await res.json();
        setAuthenticated(true);
        setEngagementId(data.engagementId);
        setClientEmail(data.clientEmail);
        toast({ title: "Authenticated via Magic Link", description: `Welcome to the secure audit data room.` });
      }
    } catch {
      // not authenticated
    }
  };

  const checkSession = async () => {
    try {
      const res = await fetch("/api/portal/session");
      if (res.ok) {
        const data = await res.json();
        setAuthenticated(true);
        setEngagementId(data.engagementId);
        setClientEmail(data.clientEmail);
      }
    } catch {
      // not authenticated
    }
  };

  // Generate demo magic link
  const requestDemoLink = async () => {
    try {
      const res = await fetch("/api/portal/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engagementId, clientEmail }),
      });
      const data = await res.json();
      if (res.ok && data.rawToken) {
        setToken(data.rawToken);
        await verifyToken(data.rawToken);
      }
    } catch (err) {
      toast({ title: "Failed to generate link", description: (err as Error).message, variant: "destructive" });
    }
  };

  // Fetch PBC items
  const { data: pbcItems = [], refetch: refetchItems } = useQuery<PbcItem[]>({
    queryKey: ["/api/portal/pbc-items", authenticated, token],
    queryFn: async () => {
      const res = await fetch("/api/portal/pbc-items", {
        headers: token ? { "x-portal-token": token } : {},
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: authenticated,
  });

  // Fetch messages for active item
  const { data: messages = [], refetch: refetchMessages } = useQuery<ThreadMessage[]>({
    queryKey: ["/api/portal/pbc-items", activeItem?.id, "messages"],
    queryFn: async () => {
      if (!activeItem) return [];
      const res = await fetch(`/api/portal/pbc-items/${activeItem.id}/messages`, {
        headers: token ? { "x-portal-token": token } : {},
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!activeItem && authenticated,
  });

  const uploadPbcFile = async (item: PbcItem, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const res = await fetch(`/api/portal/pbc-items/${item.id}/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-portal-token": token,
        },
        body: JSON.stringify({ fileName: file.name }),
      });

      if (!res.ok) throw new Error("Upload failed");

      toast({
        title: "File Uploaded",
        description: `${file.name} uploaded for ${item.itemName}.`,
      });

      refetchItems();
    } catch (err) {
      toast({ title: "Upload failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  const sendMessage = async () => {
    if (!activeItem || !chatMessage.trim()) return;

    try {
      const res = await fetch(`/api/portal/pbc-items/${activeItem.id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-portal-token": token,
        },
        body: JSON.stringify({ content: chatMessage }),
      });

      if (res.ok) {
        setChatMessage("");
        refetchMessages();
      }
    } catch (err) {
      toast({ title: "Failed to send", description: (err as Error).message, variant: "destructive" });
    }
  };

  const completedCount = pbcItems.filter((i) => i.status === "received" || i.status === "reviewed").length;
  const progressPercent = pbcItems.length ? Math.round((completedCount / pbcItems.length) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 rounded-xl shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4" />
            Secure Client Data Room
          </div>
          <h1 className="text-2xl font-bold">Client Document Intake & PBC Checklist</h1>
          <p className="text-slate-300 text-xs mt-1">
            Passwordless magic-link authenticated portal for client document delivery and real-time audit queries.
          </p>
        </div>

        <div className="text-right">
          <div className="text-xs text-slate-400">Authenticated Client</div>
          <div className="font-semibold text-sm">{clientEmail}</div>
        </div>
      </div>

      {/* Demo Magic Link Bar */}
      {!authenticated && (
        <Card className="border-amber-200 bg-amber-50/70">
          <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2 text-amber-900">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Simulate Client Magic Link access for Engagement #{engagementId}:</span>
            </div>
            <Button size="sm" onClick={requestDemoLink} className="gap-2 bg-amber-700 hover:bg-amber-800 text-white">
              Authenticate via Magic Link
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Progress Metric */}
      {authenticated && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-muted-foreground uppercase font-semibold">PBC Progress</span>
              <p className="text-2xl font-bold mt-1">{progressPercent}%</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
          </Card>

          <Card className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-muted-foreground uppercase font-semibold">Documents Received</span>
              <p className="text-2xl font-bold mt-1">{completedCount} of {pbcItems.length}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
          </Card>

          <Card className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-muted-foreground uppercase font-semibold">Pending Requests</span>
              <p className="text-2xl font-bold mt-1 text-amber-600">{pbcItems.length - completedCount}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
          </Card>
        </div>
      )}

      {/* PBC Checklist & Chat Grid */}
      {authenticated && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* PBC List */}
          <div className="lg:col-span-2 space-y-3">
            <h3 className="font-semibold text-base">Requested Audit Documents (PBC)</h3>
            {pbcItems.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground">
                No document requests active for this engagement.
              </Card>
            ) : (
              pbcItems.map((item) => (
                <Card 
                  key={item.id} 
                  className={`p-4 transition-all border ${
                    activeItem?.id === item.id ? "border-primary shadow-sm" : "hover:border-slate-300"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {item.category}
                        </span>
                        <h4 className="font-semibold text-sm">{item.itemName}</h4>
                        {item.status === "received" ? (
                          <Badge className="bg-emerald-500 text-xs">Received</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">Requested</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{item.description || "Required audit documentation."}</p>
                      {item.fileName && (
                        <p className="text-xs text-slate-600 font-medium flex items-center gap-1 mt-1">
                          <FileText className="w-3 h-3" /> Attached: {item.fileName}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs"
                        onClick={() => setActiveItem(item)}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Questions
                      </Button>

                      <label className="cursor-pointer">
                        <Button size="sm" asChild className="gap-1 text-xs">
                          <span>
                            <Upload className="w-3.5 h-3.5" />
                            {item.status === "received" ? "Replace" : "Upload"}
                          </span>
                        </Button>
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => uploadPbcFile(item, e)}
                        />
                      </label>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Discussion Thread */}
          <div className="lg:col-span-1">
            <Card className="h-full flex flex-col min-h-[400px]">
              <CardHeader className="p-4 border-b">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  {activeItem ? `Item Discussion: ${activeItem.itemName}` : "Audit Team Discussion"}
                </CardTitle>
                <CardDescription className="text-xs">
                  {activeItem ? "Direct thread linked to this document." : "Select an item to view or ask questions."}
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 flex-1 flex flex-col justify-between">
                {activeItem ? (
                  <>
                    <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px] mb-4 pr-1">
                      {messages.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-6">
                          No messages yet. Ask a question regarding this document request.
                        </p>
                      ) : (
                        messages.map((m) => (
                          <div 
                            key={m.id} 
                            className={`p-2.5 rounded-lg text-xs ${
                              m.authorType === "client" 
                                ? "bg-primary text-primary-foreground ml-4" 
                                : "bg-slate-100 text-slate-800 mr-4"
                            }`}
                          >
                            <div className="font-semibold text-[10px] opacity-80 mb-0.5">
                              {m.authorName || (m.authorType === "client" ? "You" : "Audit Team")}
                            </div>
                            <div>{m.content}</div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex gap-2 pt-2 border-t">
                      <Input
                        placeholder="Type question or note..."
                        className="text-xs h-9"
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                      />
                      <Button size="sm" onClick={sendMessage} className="h-9 px-3">
                        <Send className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center text-xs text-muted-foreground p-6">
                    <MessageSquare className="w-8 h-8 text-slate-300 mb-2" />
                    Click "Questions" on any PBC item to view notes or message the audit team.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
