import { useState, useEffect } from "react";
import { 
  useListDataRoomItems, 
  useCreateDataRoomItem, 
  useUpdateDataRoomItem,
  useListEngagements 
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter, 
  DialogDescription,
  DialogTrigger 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, 
  KeyRound, 
  FolderLock, 
  MessageSquare, 
  Send, 
  CheckCircle2, 
  Clock, 
  Trash2, 
  Copy, 
  Check, 
  Filter,
  FileCheck,
  Bot
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface ThreadMessage {
  id: number;
  role: string;
  content: string;
  authorType: string;
  authorName: string | null;
  createdAt: string;
}

export default function DataRoomPage() {
  const queryClient = useQueryClient();

  // URL query params
  const urlParams = new URLSearchParams(window.location.search);
  const initialEngagementId = urlParams.get("engagementId") 
    ? parseInt(urlParams.get("engagementId")!, 10) 
    : undefined;

  const [selectedEngagementId, setSelectedEngagementId] = useState<number | undefined>(initialEngagementId);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const { data: engagements } = useListEngagements();
  const { data: items, isLoading } = useListDataRoomItems(
    selectedEngagementId ? { engagementId: selectedEngagementId } : undefined
  );

  const createItemMutation = useCreateDataRoomItem();
  const updateItemMutation = useUpdateDataRoomItem();

  // Create PBC Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("Cash & Banking");
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemEngId, setNewItemEngId] = useState<number>(selectedEngagementId || 1);

  // Magic Link Modal State
  const [isMagicOpen, setIsMagicOpen] = useState(false);
  const [magicEmail, setMagicEmail] = useState("");
  const [magicEngId, setMagicEngId] = useState<number>(selectedEngagementId || 1);
  const [magicUrl, setMagicUrl] = useState<string | null>(null);
  const [isGeneratingMagic, setIsGeneratingMagic] = useState(false);
  const [isCopiedMagic, setIsCopiedMagic] = useState(false);

  // Discussion Drawer State
  const [activeItem, setActiveItem] = useState<any | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Fetch messages when active item changes
  useEffect(() => {
    if (!activeItem) return;
    let isSubscribed = true;
    setIsLoadingMessages(true);
    fetch(`/api/data-room/${activeItem.id}/messages`)
      .then(res => res.json())
      .then(data => {
        if (isSubscribed) setMessages(Array.isArray(data) ? data : []);
      })
      .catch(console.error)
      .finally(() => {
        if (isSubscribed) setIsLoadingMessages(false);
      });

    return () => { isSubscribed = false; };
  }, [activeItem?.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem || !newMessage.trim() || isSendingMessage) return;
    setIsSendingMessage(true);
    try {
      const res = await fetch(`/api/data-room/${activeItem.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newMessage.trim(),
          authorName: "Audit Engagement Senior",
        }),
      });
      if (res.ok) {
        const sent = await res.json();
        setMessages(prev => [...prev, sent]);
        setNewMessage("");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleCreatePBC = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName) return;
    try {
      await createItemMutation.mutateAsync({
        data: {
          engagementId: newItemEngId,
          itemName: newItemName,
          category: newItemCategory,
          description: newItemDesc || null,
        },
      });
      setIsCreateOpen(false);
      setNewItemName("");
      setNewItemDesc("");
      queryClient.invalidateQueries({ queryKey: [`/api/data-room`] });
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatusChange = async (itemId: number, newStatus: string) => {
    try {
      await updateItemMutation.mutateAsync({
        id: itemId,
        data: { status: newStatus },
      });
      if (activeItem && activeItem.id === itemId) {
        setActiveItem({ ...activeItem, status: newStatus });
      }
      queryClient.invalidateQueries({ queryKey: [`/api/data-room`] });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteItem = async (itemId: number) => {
    if (!confirm("Are you sure you want to remove this PBC item?")) return;
    try {
      await fetch(`/api/data-room/${itemId}`, { method: "DELETE" });
      if (activeItem?.id === itemId) setActiveItem(null);
      queryClient.invalidateQueries({ queryKey: [`/api/data-room`] });
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerateMagic = async () => {
    if (!magicEmail || !magicEmail.includes("@")) return;
    setIsGeneratingMagic(true);
    try {
      const res = await fetch("/api/portal/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientEmail: magicEmail,
          engagementId: magicEngId,
        }),
      });
      const data = await res.json();
      if (data.magicLinkUrl) {
        setMagicUrl(data.magicLinkUrl);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingMagic(false);
    }
  };

  const handleCopyMagic = () => {
    if (magicUrl) {
      navigator.clipboard.writeText(magicUrl);
      setIsCopiedMagic(true);
      setTimeout(() => setIsCopiedMagic(false), 2000);
    }
  };

  const filteredItems = items?.filter(item => {
    if (selectedCategory !== "all" && item.category !== selectedCategory) return false;
    return true;
  }) || [];

  const categories = Array.from(new Set(items?.map(i => i.category) || ["Cash & Banking", "Revenue & Receivables", "Fixed Assets", "Payroll", "Governance"]));

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <FolderLock className="w-8 h-8 text-primary" />
            Data Room & Client PBC Intake
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Provided-by-Client (PBC) checklist, secure document repository, and external client discussions.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Issue Magic Link Dialog */}
          <Dialog open={isMagicOpen} onOpenChange={setIsMagicOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <KeyRound className="w-4 h-4 text-amber-500" /> Issue Client Magic Link
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-amber-500" /> External Client Portal Access
                </DialogTitle>
                <DialogDescription>
                  Generates an authenticated, passwordless magic link scoped strictly to the client's PBC items.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div>
                  <label className="text-xs font-medium block mb-1">Target Engagement</label>
                  <select
                    value={magicEngId}
                    onChange={(e) => setMagicEngId(Number(e.target.value))}
                    className="w-full text-xs px-2.5 py-2 rounded border bg-background"
                  >
                    {engagements?.map(eng => (
                      <option key={eng.id} value={eng.id}>
                        {eng.engagementName} ({eng.client?.name || "Corporate"})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium block mb-1">Client Contact Email</label>
                  <Input
                    type="email"
                    placeholder="controller@client.com"
                    value={magicEmail}
                    onChange={(e) => setMagicEmail(e.target.value)}
                  />
                </div>

                {magicUrl && (
                  <div className="p-3 rounded bg-muted/60 space-y-2 border">
                    <div className="text-xs font-medium text-foreground flex items-center justify-between">
                      <span>Client Access Link:</span>
                      <Button variant="ghost" size="sm" onClick={handleCopyMagic} className="h-6 text-xs gap-1">
                        {isCopiedMagic ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        {isCopiedMagic ? "Copied" : "Copy"}
                      </Button>
                    </div>
                    <div className="font-mono text-xs break-all p-2 rounded bg-background border text-primary">
                      {magicUrl}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Valid for 24 hours. Sets an encrypted HTTP-only session cookie upon click.
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button 
                  onClick={handleGenerateMagic} 
                  disabled={isGeneratingMagic || !magicEmail}
                  className="w-full sm:w-auto"
                >
                  {isGeneratingMagic ? "Generating Link..." : "Create Magic Link"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* New PBC Request Dialog */}
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 text-xs bg-primary text-primary-foreground">
                <Plus className="w-4 h-4" /> New PBC Request
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <form onSubmit={handleCreatePBC}>
                <DialogHeader>
                  <DialogTitle>Add PBC Request Item</DialogTitle>
                  <DialogDescription>
                    Request source documentation, schedules, or certifications from the client.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-3">
                  <div>
                    <label className="text-xs font-medium block mb-1">Engagement</label>
                    <select
                      value={newItemEngId}
                      onChange={(e) => setNewItemEngId(Number(e.target.value))}
                      className="w-full text-xs px-2.5 py-2 rounded border bg-background"
                    >
                      {engagements?.map(eng => (
                        <option key={eng.id} value={eng.id}>
                          {eng.engagementName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium block mb-1">Item Title / Requirement</label>
                    <Input
                      required
                      placeholder="e.g. December 2026 Bank Confirmation Letters"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium block mb-1">Audit Category</label>
                    <select
                      value={newItemCategory}
                      onChange={(e) => setNewItemCategory(e.target.value)}
                      className="w-full text-xs px-2.5 py-2 rounded border bg-background"
                    >
                      <option value="Cash & Banking">Cash & Banking</option>
                      <option value="Revenue & Receivables">Revenue & Receivables</option>
                      <option value="Expenses & Payables">Expenses & Payables</option>
                      <option value="Fixed Assets">Fixed Assets</option>
                      <option value="Payroll & HR">Payroll & HR</option>
                      <option value="Governance & Legal">Governance & Legal</option>
                      <option value="Tax & Regulatory">Tax & Regulatory</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium block mb-1">Instructions for Client</label>
                    <Textarea
                      rows={3}
                      placeholder="Specify required file formats, period coverage, or signature requirements..."
                      value={newItemDesc}
                      onChange={(e) => setNewItemDesc(e.target.value)}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createItemMutation.isPending}>
                    {createItemMutation.isPending ? "Creating..." : "Add to PBC List"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 bg-card border rounded-lg">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Filter:</span>

          <select
            value={selectedEngagementId || ""}
            onChange={(e) => setSelectedEngagementId(e.target.value ? Number(e.target.value) : undefined)}
            className="text-xs px-2.5 py-1.5 rounded border bg-background"
          >
            <option value="">All Engagements</option>
            {engagements?.map(eng => (
              <option key={eng.id} value={eng.id}>{eng.engagementName}</option>
            ))}
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded border bg-background capitalize"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div className="text-xs text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{filteredItems.length}</span> PBC items
        </div>
      </div>

      {/* Main Grid: Items List + In-Context Discussion Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Items List (2 cols on large) */}
        <div className="lg:col-span-2 space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
            </div>
          ) : filteredItems.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground space-y-3">
                <FolderLock className="w-10 h-10 mx-auto text-muted-foreground/60" />
                <h3 className="font-medium text-foreground">No PBC requests found</h3>
                <p className="text-xs max-w-sm mx-auto">
                  Create PBC items to request audit schedules, bank confirmations, and general ledger extracts.
                </p>
                <Button size="sm" onClick={() => setIsCreateOpen(true)} className="mt-2">
                  <Plus className="w-4 h-4 mr-1.5" /> Create First PBC Item
                </Button>
              </CardContent>
            </Card>
          ) : (
            filteredItems.map(item => {
              const isSelected = activeItem?.id === item.id;
              return (
                <Card 
                  key={item.id} 
                  className={`transition-all hover:border-primary/50 cursor-pointer ${
                    isSelected ? "border-primary ring-1 ring-primary/20 bg-muted/20" : ""
                  }`}
                  onClick={() => setActiveItem(item)}
                >
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted">
                          PBC-{item.id}
                        </span>
                        <h4 className="font-semibold text-sm text-foreground truncate">{item.itemName}</h4>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="capitalize">{item.category}</span>
                        <span>•</span>
                        <Badge 
                          variant={item.status === "received" ? "default" : item.status === "cleared" ? "outline" : "secondary"}
                          className="text-[10px] capitalize py-0"
                        >
                          {item.status}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveItem(item);
                        }}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Discuss
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteItem(item.id);
                        }}
                        title="Delete Item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Right: In-Context Discussion Drawer (1 col) */}
        <div className="space-y-4">
          {activeItem ? (
            <Card className="border shadow-sm flex flex-col h-[600px]">
              <CardHeader className="p-4 border-b bg-muted/20">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[11px] font-mono font-semibold text-muted-foreground">
                      PBC-{activeItem.id} • {activeItem.category}
                    </div>
                    <CardTitle className="text-sm font-bold text-foreground mt-0.5">
                      {activeItem.itemName}
                    </CardTitle>
                  </div>

                  <select
                    value={activeItem.status}
                    onChange={(e) => handleStatusChange(activeItem.id, e.target.value)}
                    className="text-xs px-2 py-1 rounded border bg-background"
                  >
                    <option value="pending">Pending Client</option>
                    <option value="received">Received</option>
                    <option value="under_review">Under Review</option>
                    <option value="cleared">Cleared / Accepted</option>
                  </select>
                </div>
              </CardHeader>

              {/* Message Feed */}
              <CardContent className="p-4 flex-1 overflow-y-auto space-y-3">
                {isLoadingMessages ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-3/4" />
                    <Skeleton className="h-12 w-3/4 ml-auto" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-4">
                    <MessageSquare className="w-8 h-8 text-muted-foreground/40 mb-2" />
                    <p className="text-xs font-medium">No messages in this PBC thread yet.</p>
                    <p className="text-[11px]">Post a note or clarification below. The external client will see it in their portal.</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isAuditor = msg.authorType === "auditor";
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col max-w-[85%] rounded-lg p-3 text-xs ${
                          isAuditor
                            ? "ml-auto bg-primary text-primary-foreground"
                            : "mr-auto bg-muted border text-foreground"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[10px] opacity-80 mb-1">
                          <span className="font-semibold">{msg.authorName || (isAuditor ? "Auditor" : "Client")}</span>
                          <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    );
                  })
                )}
              </CardContent>

              {/* Chat Input */}
              <div className="p-3 border-t bg-card">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <Input
                    placeholder="Type client instruction or question..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="text-xs h-9"
                  />
                  <Button type="submit" size="sm" disabled={isSendingMessage || !newMessage.trim()} className="h-9 px-3">
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </form>
              </div>
            </Card>
          ) : (
            <Card className="border-dashed p-8 text-center text-muted-foreground space-y-2 h-[350px] flex flex-col items-center justify-center">
              <MessageSquare className="w-8 h-8 text-muted-foreground/50" />
              <p className="text-sm font-medium">Select a PBC Item</p>
              <p className="text-xs max-w-xs">
                Click "Discuss" on any checklist item to inspect client uploads and communicate directly without email.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
